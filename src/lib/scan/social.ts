// Open Graph / Twitter Card meta-tag inspector: every tag gets its own
// pass/warn/fail finding (not just "missing or not"), including length
// guidance and og:image's real dimensions/aspect ratio — mirroring what a
// tool like opengraph.xyz's inspector reports, not just a bare tag dump.
import type { Finding, SocialCard } from '../../data/types';

export interface ImageProbeResult {
  ok: boolean;
  width?: number;
  height?: number;
}

export interface SocialRawData {
  title: string | null;
  description: string | null;
  og: Record<string, string | null>;
  twitter: Record<string, string | null>;
  /** null = no og:image set at all. */
  ogImage: ImageProbeResult | null;
}

const OG_KEYS = ['og:title', 'og:description', 'og:image', 'og:url', 'og:type'];
const TWITTER_KEYS = ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image'];

function metaContent(doc: Document, selector: string): string | null {
  return doc.querySelector(selector)?.getAttribute('content')?.trim() || null;
}

// A cross-origin fetch() HEAD would spuriously fail on any host that
// doesn't send CORS headers on the response — most image CDNs, despite the
// image loading perfectly fine as an <img>. Probing via Image() load/error
// uses the same unrestricted path the browser (and og:image consumers)
// actually use to load it, and gives us real pixel dimensions for free.
function probeImage(url: string, timeoutMs = 6000): Promise<ImageProbeResult> {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => settle({ ok: false }), timeoutMs);
    function settle(result: ImageProbeResult) {
      clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
      resolve(result);
    }
    img.onload = () => settle({ ok: true, width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => settle({ ok: false });
    img.src = url;
  });
}

export async function gatherSocial(doc: Document = document): Promise<SocialRawData> {
  const title = doc.querySelector('title')?.textContent?.trim() || null;
  const description = doc.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || null;

  const og: Record<string, string | null> = {};
  for (const key of OG_KEYS) og[key] = metaContent(doc, `meta[property="${key}"]`);

  const twitter: Record<string, string | null> = {};
  for (const key of TWITTER_KEYS) twitter[key] = metaContent(doc, `meta[name="${key}"]`);

  let ogImage: ImageProbeResult | null = null;
  if (og['og:image']) {
    try {
      const url = new URL(og['og:image'], doc.baseURI).href;
      ogImage = await probeImage(url);
    } catch {
      ogImage = { ok: false };
    }
  }

  return { title, description, og, twitter, ogImage };
}

function lengthFinding(id: string, label: string, tag: string, value: string, min: number, max: number): Finding {
  const len = value.length;
  if (len > max) {
    return {
      id,
      title: `${label} is long`,
      detail: `${len} characters — over the ~${max} platforms typically show before truncating.`,
      severity: 'warning',
      path: tag,
    };
  }
  if (len < min) {
    return {
      id,
      title: `${label} is short`,
      detail: `${len} characters — a bit thin for a good preview.`,
      severity: 'warning',
      path: tag,
    };
  }
  return {
    id,
    title: `${label} is present`,
    detail: `${len} characters — within the recommended range.`,
    severity: 'normal',
    path: tag,
  };
}

const PLATFORMS = ['Facebook', 'X', 'LinkedIn', 'WhatsApp', 'Discord'];

export function evaluateSocial(raw: SocialRawData): { findings: Finding[]; cards: SocialCard[] } {
  const findings: Finding[] = [];
  const ogTitle = raw.og['og:title'];
  const ogDesc = raw.og['og:description'];
  const ogImageUrl = raw.og['og:image'];

  if (!ogTitle) {
    findings.push({
      id: 'meta-og-title',
      title: 'og:title missing',
      detail: 'Platforms fall back to guessing a title when og:title is not set.',
      severity: 'critical',
      path: 'og:title',
    });
  } else {
    findings.push(lengthFinding('meta-og-title', 'og:title', 'og:title', ogTitle, 10, 70));
  }

  if (!ogDesc) {
    findings.push({
      id: 'meta-og-description',
      title: 'og:description missing',
      detail: 'Platforms fall back to scraped body copy when og:description is not set.',
      severity: 'critical',
      path: 'og:description',
    });
  } else {
    findings.push(lengthFinding('meta-og-description', 'og:description', 'og:description', ogDesc, 20, 200));
  }

  if (!ogImageUrl) {
    findings.push({
      id: 'meta-og-image',
      title: 'og:image missing',
      detail: 'Most platforms will not render a card at all without an image.',
      severity: 'critical',
      path: 'og:image',
    });
  } else if (!raw.ogImage?.ok) {
    findings.push({
      id: 'meta-og-image',
      title: 'og:image failed to load',
      detail: `${ogImageUrl} did not load — platforms will drop the image, or the whole card.`,
      severity: 'critical',
      path: 'og:image',
    });
  } else {
    const { width, height } = raw.ogImage;
    findings.push({
      id: 'meta-og-image',
      title: 'Image loads cleanly',
      detail: width && height ? `${width}×${height}` : 'Loaded successfully.',
      severity: 'normal',
      path: 'og:image',
    });
    if (width && height) {
      const ratio = width / height;
      if (width < 200 || height < 200) {
        findings.push({
          id: 'meta-og-image-size',
          title: 'Image is smaller than platforms recommend',
          detail: `${width}×${height} — most platforms want at least 200×200, ideally 1200×630.`,
          severity: 'warning',
          path: 'og:image',
        });
      } else if (ratio < 1.7 || ratio > 2.1) {
        findings.push({
          id: 'meta-og-image-ratio',
          title: 'Image aspect ratio may crop oddly',
          detail: `${width}×${height} (${ratio.toFixed(2)}:1) — the ~1.91:1 recommended ratio (e.g. 1200×630) crops more predictably.`,
          severity: 'warning',
          path: 'og:image',
        });
      }
    }
  }

  if (!raw.og['og:url']) {
    findings.push({
      id: 'meta-og-url',
      title: 'og:url missing',
      detail: 'Without a canonical share URL, likes and shares can fragment across URL variants.',
      severity: 'warning',
      path: 'og:url',
    });
  } else {
    findings.push({ id: 'meta-og-url', title: 'og:url is present', detail: raw.og['og:url'], severity: 'normal', path: 'og:url' });
  }

  if (!raw.og['og:type']) {
    findings.push({
      id: 'meta-og-type',
      title: 'og:type missing',
      detail: 'Defaults to "website" on most platforms — set it explicitly for articles, products, etc.',
      severity: 'warning',
      path: 'og:type',
    });
  } else {
    findings.push({ id: 'meta-og-type', title: 'og:type is present', detail: raw.og['og:type'], severity: 'normal', path: 'og:type' });
  }

  const card = raw.twitter['twitter:card'];
  if (!card) {
    findings.push({
      id: 'meta-twitter-card',
      title: 'twitter:card missing',
      detail: 'X falls back to a bare link preview without a card type.',
      severity: 'warning',
      path: 'twitter:card',
    });
  } else if (card === 'summary_large_image') {
    findings.push({
      id: 'meta-twitter-card',
      title: 'X card uses a large image',
      detail: 'summary_large_image is set, so X can render the image at full card width.',
      severity: 'normal',
      path: 'twitter:card',
    });
  } else if (card === 'summary') {
    findings.push({
      id: 'meta-twitter-card',
      title: 'X card uses a small image',
      detail: '"summary" shows a small square thumbnail — summary_large_image usually previews better.',
      severity: 'normal',
      path: 'twitter:card',
    });
  } else {
    findings.push({
      id: 'meta-twitter-card',
      title: `Unrecognized twitter:card value "${card}"`,
      detail: 'X expects "summary" or "summary_large_image".',
      severity: 'warning',
      path: 'twitter:card',
    });
  }

  const twitterTitle = raw.twitter['twitter:title'];
  if (twitterTitle) {
    findings.push(lengthFinding('meta-twitter-title', 'X title', 'twitter:title', twitterTitle, 10, 70));
  } else if (ogTitle) {
    findings.push({
      id: 'meta-twitter-title',
      title: 'X title falls back to og:title',
      detail: 'twitter:title is not set, but X reads og:title instead.',
      severity: 'normal',
      path: 'twitter:title',
    });
  } else {
    findings.push({
      id: 'meta-twitter-title',
      title: 'X title missing',
      detail: 'Neither twitter:title nor og:title is set.',
      severity: 'warning',
      path: 'twitter:title',
    });
  }

  const twitterDesc = raw.twitter['twitter:description'];
  if (twitterDesc) {
    findings.push(lengthFinding('meta-twitter-description', 'X description', 'twitter:description', twitterDesc, 20, 200));
  } else if (ogDesc) {
    findings.push({
      id: 'meta-twitter-description',
      title: 'X description falls back to og:description',
      detail: 'twitter:description is not set, but X reads og:description instead.',
      severity: 'normal',
      path: 'twitter:description',
    });
  } else {
    findings.push({
      id: 'meta-twitter-description',
      title: 'X description missing',
      detail: 'Neither twitter:description nor og:description is set.',
      severity: 'warning',
      path: 'twitter:description',
    });
  }

  const twitterImage = raw.twitter['twitter:image'];
  if (twitterImage) {
    findings.push({
      id: 'meta-twitter-image',
      title: 'X image is present',
      detail: 'twitter:image is set and can be used for the X preview.',
      severity: 'normal',
      path: 'twitter:image',
    });
  } else if (ogImageUrl) {
    findings.push({
      id: 'meta-twitter-image',
      title: 'X image falls back to og:image',
      detail: 'twitter:image is not set, but X reads og:image instead.',
      severity: 'normal',
      path: 'twitter:image',
    });
  } else {
    findings.push({
      id: 'meta-twitter-image',
      title: 'X image missing',
      detail: 'Neither twitter:image nor og:image is set.',
      severity: 'warning',
      path: 'twitter:image',
    });
  }

  const resolvedTitle = ogTitle || raw.title || 'Untitled page';
  const resolvedDescription = ogDesc || twitterDesc || raw.description;
  const resolvedImage = ogImageUrl || twitterImage || undefined;

  const cards: SocialCard[] = PLATFORMS.map((platform) => ({
    id: platform.toLowerCase(),
    platform,
    title: resolvedTitle,
    description: resolvedDescription,
    imageSeed: resolvedTitle,
    imageUrl: resolvedImage,
  }));

  return { findings, cards };
}
