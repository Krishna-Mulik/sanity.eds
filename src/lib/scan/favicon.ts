// Favicon <link> check: verifies it actually resolves (not a 404/dead URL)
// rather than just checking the tag exists — a generic meta-tag inspector
// only sees the <link>, never whether the resource behind it loads. Lives
// in SEO, not Security/Limits, since it's a <head> <link> tag read the same
// way as canonical/viewport.
//
// Probed with an Image() load, same technique used for og:image
// (social.ts) and for the same reason: a fetch() would false-positive
// "broken" on a perfectly valid cross-origin/CDN-hosted favicon that a
// browser loads without needing CORS headers at all.
import type { Finding } from '../../data/types';
import { relativizeUrl } from '../format';

export interface FaviconRawData {
  faviconHref: string | null;
}

export function gatherFaviconLink(doc: Document = document): FaviconRawData {
  return {
    faviconHref: doc.querySelector<HTMLLinkElement>('link[rel~="icon"]')?.href || null,
  };
}

const CHECK_TIMEOUT_MS = 5000;

function probeImageLoads(url: string, timeoutMs = CHECK_TIMEOUT_MS): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => settle(false), timeoutMs);
    function settle(ok: boolean) {
      clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
      resolve(ok);
    }
    img.onload = () => settle(true);
    img.onerror = () => settle(false);
    img.src = url;
  });
}

/** Resolves true (loads), false (broken), or null (no favicon link to check). */
export async function checkFavicon(raw: FaviconRawData): Promise<boolean | null> {
  return raw.faviconHref ? probeImageLoads(raw.faviconHref) : null;
}

export function evaluateFavicon(raw: FaviconRawData, faviconLoaded: boolean | null, origin = ''): Finding[] {
  const findings: Finding[] = [];

  if (!raw.faviconHref) {
    findings.push({
      id: 'seo-favicon-missing',
      title: 'No favicon link found',
      detail: 'Browsers still request /favicon.ico by convention, but an explicit <link rel="icon"> avoids relying on that fallback and lets you specify a modern format.',
      severity: 'warning',
      path: 'head > link[rel="icon"]',
    });
  } else if (faviconLoaded === false) {
    findings.push({
      id: 'seo-favicon-broken',
      title: 'Favicon link is broken',
      detail: "The linked favicon failed to load — it 404s, the URL is wrong, or the file isn't a valid image.",
      severity: 'critical',
      path: relativizeUrl(raw.faviconHref, origin),
    });
  }

  return findings;
}
