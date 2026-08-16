// Canonical URL, title/description, viewport/robots meta, and a
// lightweight common-misspellings check (a small curated list, not a full
// dictionary — real, but documented as limited so it never claims more
// coverage than it has).
//
// Alt text and heading order/presence are deliberately NOT double-reported
// as Findings here — axe-core (Accessibility section) already runs
// image-alt, heading-order, and page-has-heading-one as part of its default
// ruleset, more rigorously than a hand-rolled check could (it accounts for
// role="presentation", aria-label alternatives, etc.). Duplicating that as
// a second Finding produced two findings for the same underlying problem.
// `headings` and `imagesMissingAlt` are still gathered and shown as plain
// overview lists in the Structure tab (headings for the one gap axe leaves
// — multiple H1s, evaluated in accessibility.ts; images so the specific
// offending images are visible while looking at the page's structure) —
// visual aids pointing at what's already been judged elsewhere, not a
// second verdict.
import type { Finding, SeoPageInfo } from '../../data/types';
import { buildSelector } from '../selector';

export interface HeadingInfo {
  level: number;
  text: string;
  selector: string;
}

export interface TextNodeInfo {
  text: string;
  selector: string;
}

export interface RawImageInfo {
  hasAlt: boolean;
  role: string | null;
  ariaHidden: string | null;
  selector: string;
  src: string;
}

export interface MissingAltImage {
  selector: string;
  src: string;
}

export interface SeoRawData {
  title: string | null;
  metaDescription: string | null;
  canonicalHref: string | null;
  currentUrl: string;
  viewportPresent: boolean;
  robotsContent: string | null;
  keywordsContent: string | null;
  authorContent: string | null;
  publisherContent: string | null;
  htmlLang: string | null;
  imageCount: number;
  headings: HeadingInfo[];
  textNodes: TextNodeInfo[];
  fontsUsed: string[];
  imagesMissingAlt: MissingAltImage[];
}

/**
 * Font families actually loaded for this render, via the CSS Font Loading
 * API — reflects what's really on the page (including web fonts pulled in
 * by an EDS block's own CSS), not just what a stylesheet declares. Returns
 * [] in environments without the API (e.g. jsdom in tests).
 */
function gatherFonts(doc: Document = document): string[] {
  if (!doc.fonts || typeof doc.fonts.forEach !== 'function') return [];
  const families = new Set<string>();
  doc.fonts.forEach((face) => {
    if (face.status === 'loaded') families.add(face.family.replace(/^["']|["']$/g, ''));
  });
  return Array.from(families).sort();
}

function collectImages(doc: Document): RawImageInfo[] {
  return Array.from(doc.querySelectorAll('img'))
    .filter((img) => !img.closest('#sanity-panel-host') && !img.closest('aem-sidekick'))
    .map((img) => ({
      hasAlt: img.hasAttribute('alt'),
      role: img.getAttribute('role'),
      ariaHidden: img.getAttribute('aria-hidden'),
      selector: buildSelector(img),
      src: img.currentSrc || img.src,
    }));
}

/**
 * Images with no alt attribute at all, excluding ones explicitly marked
 * decorative (role="presentation"/"none", or aria-hidden="true") — those
 * are intentionally outside the accessibility tree, so a missing alt on
 * them isn't the same authoring gap axe-core's image-alt rule is built to
 * catch (and doesn't flag them either, for the same reason).
 */
export function selectImagesMissingAlt(images: RawImageInfo[]): MissingAltImage[] {
  return images
    .filter((img) => !img.hasAlt && img.role !== 'presentation' && img.role !== 'none' && img.ariaHidden !== 'true')
    .map((img) => ({ selector: img.selector, src: img.src }));
}

function collectTextNodes(doc: Document): TextNodeInfo[] {
  const body = doc.body;
  if (!body) return [];
  const walker = doc.createTreeWalker(body, NodeFilter.SHOW_TEXT, {
    acceptNode(node: Node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
      if (parent.closest('#sanity-panel-host')) return NodeFilter.FILTER_REJECT;
      if (!node.textContent || !node.textContent.trim()) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const out: TextNodeInfo[] = [];
  let node = walker.nextNode();
  while (node) {
    out.push({ text: node.textContent || '', selector: buildSelector(node.parentElement!) });
    node = walker.nextNode();
  }
  return out;
}

export function gatherSeo(doc: Document = document, win: Window = window): SeoRawData {
  return {
    title: doc.querySelector('title')?.textContent?.trim() || null,
    metaDescription: doc.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || null,
    canonicalHref: doc.querySelector('link[rel="canonical"]')?.getAttribute('href') || null,
    currentUrl: win.location.href,
    viewportPresent: Boolean(doc.querySelector('meta[name="viewport"]')),
    robotsContent: doc.querySelector('meta[name="robots"]')?.getAttribute('content') || null,
    keywordsContent: doc.querySelector('meta[name="keywords"]')?.getAttribute('content')?.trim() || null,
    authorContent: doc.querySelector('meta[name="author"]')?.getAttribute('content')?.trim() || null,
    publisherContent: doc.querySelector('meta[name="publisher"]')?.getAttribute('content')?.trim() || null,
    htmlLang: doc.documentElement.getAttribute('lang') || null,
    imageCount: doc.querySelectorAll('img').length,
    headings: Array.from(doc.querySelectorAll('h1,h2,h3,h4,h5,h6')).map((el) => ({
      level: Number(el.tagName[1]),
      text: (el.textContent || '').trim(),
      selector: buildSelector(el),
    })),
    textNodes: collectTextNodes(doc),
    fontsUsed: gatherFonts(doc),
    imagesMissingAlt: selectImagesMissingAlt(collectImages(doc)),
  };
}

/**
 * Plain overview, not a check — Title/Description above already carry the
 * real pass/fail judgment. Keywords/Author/Publisher/Lang have no
 * meaningful SEO pass/fail from a single page (keywords meta has been
 * ignored by search engines since ~2009; a missing/invalid lang attribute
 * is a real issue but axe-core's html-has-lang/html-lang-valid rules
 * already own that judgment in the Accessibility section) — showing them
 * here would mean inventing a severity that isn't real.
 */
export function buildSeoPageInfo(raw: SeoRawData): SeoPageInfo {
  const headingCounts = [1, 2, 3, 4, 5, 6].map((level) => raw.headings.filter((h) => h.level === level).length);
  return {
    url: raw.currentUrl,
    canonicalHref: raw.canonicalHref,
    robotsContent: raw.robotsContent,
    keywordsContent: raw.keywordsContent,
    authorContent: raw.authorContent,
    publisherContent: raw.publisherContent,
    lang: raw.htmlLang,
    headingCounts,
    headings: raw.headings,
    imageCount: raw.imageCount,
    fontsUsed: raw.fontsUsed,
    imagesMissingAlt: raw.imagesMissingAlt,
  };
}

const COMMON_MISSPELLINGS: Record<string, string> = {
  recieve: 'receive',
  teh: 'the',
  seperate: 'separate',
  seperated: 'separated',
  occured: 'occurred',
  untill: 'until',
  wich: 'which',
  becuase: 'because',
  accomodate: 'accommodate',
  acheive: 'achieve',
  arguement: 'argument',
  begining: 'beginning',
  beleive: 'believe',
  calender: 'calendar',
  definately: 'definitely',
  existance: 'existence',
  goverment: 'government',
  immediatly: 'immediately',
  independant: 'independent',
  neccessary: 'necessary',
  noticable: 'noticeable',
  occassion: 'occasion',
  publically: 'publicly',
  recomend: 'recommend',
  similiar: 'similar',
  succesful: 'successful',
  tommorow: 'tomorrow',
  wether: 'whether',
  yeild: 'yield',
  thier: 'their',
};

function checkSpelling(textNodes: TextNodeInfo[]): Finding[] {
  const seen = new Set<string>();
  const findings: Finding[] = [];
  for (const { text, selector } of textNodes) {
    const words = text.match(/[A-Za-z']+/g);
    if (!words) continue;
    for (const word of words) {
      const lower = word.toLowerCase();
      const correction = COMMON_MISSPELLINGS[lower];
      if (!correction || seen.has(lower)) continue;
      seen.add(lower);
      findings.push({
        id: `seo-spelling-${lower}`,
        title: `Possible misspelling: "${word}"`,
        detail: `Did you mean "${correction}"? Checked against a small list of common typos, not a full dictionary.`,
        severity: 'warning',
        path: text.trim().slice(0, 60),
        targetSelector: selector,
      });
    }
  }
  return findings;
}

const CANONICAL_CHECK_TIMEOUT_MS = 5000;

export type CanonicalCheckStatus = 'not-checked' | 'ok' | 'redirected' | 'http-error' | 'network-error' | 'cross-origin-unchecked';

export interface CanonicalCheckResult {
  status: CanonicalCheckStatus;
  httpStatus?: number;
}

/**
 * Fetches the canonical URL itself (same-origin only) to confirm it
 * returns a direct 2xx, not a redirect or an error — the go-live checklist
 * calls this out explicitly since a canonical pointing at a 3xx/4xx tells
 * search engines the "real" version of the page doesn't resolve cleanly.
 * Cross-origin canonicals can't be verified this way (would need CORS
 * headers on someone else's server), so those get an honest "not checked"
 * result rather than a guess.
 */
export async function checkCanonicalStatus(raw: SeoRawData): Promise<CanonicalCheckResult> {
  if (!raw.canonicalHref) return { status: 'not-checked' };
  let resolved: URL;
  let current: URL;
  try {
    resolved = new URL(raw.canonicalHref, raw.currentUrl);
    current = new URL(raw.currentUrl);
  } catch {
    return { status: 'not-checked' };
  }
  if (resolved.origin !== current.origin) return { status: 'cross-origin-unchecked' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CANONICAL_CHECK_TIMEOUT_MS);
  try {
    const res = await fetch(resolved.href, { signal: controller.signal, cache: 'no-store' });
    if (res.redirected) return { status: 'redirected', httpStatus: res.status };
    if (!res.ok) return { status: 'http-error', httpStatus: res.status };
    return { status: 'ok', httpStatus: res.status };
  } catch {
    return { status: 'network-error' };
  } finally {
    clearTimeout(timer);
  }
}

export function evaluateCanonicalStatus(canonicalHref: string | null, check: CanonicalCheckResult): Finding[] {
  if (!canonicalHref) return [];

  switch (check.status) {
    case 'redirected':
      return [
        {
          id: 'seo-canonical-status-redirect',
          title: 'Canonical URL responds with a redirect',
          detail: `Canonical links should return a direct 2xx response${check.httpStatus ? ` — this one responds with HTTP ${check.httpStatus}` : ''}. Search engines can end up treating the redirect's destination as the real canonical instead of the URL you declared.`,
          severity: 'warning',
          path: canonicalHref,
        },
      ];
    case 'http-error':
      return [
        {
          id: 'seo-canonical-status-error',
          title: 'Canonical URL returns an error status',
          detail: `Server responded with ${check.httpStatus ?? 'an error'} — a canonical pointing at a broken URL tells search engines the "real" version of this page doesn't work.`,
          severity: 'critical',
          path: canonicalHref,
        },
      ];
    case 'network-error':
      return [
        {
          id: 'seo-canonical-status-unreachable',
          title: 'Canonical URL could not be reached',
          detail: 'The request failed outright — check the URL is correct and the target is reachable.',
          severity: 'critical',
          path: canonicalHref,
        },
      ];
    case 'cross-origin-unchecked':
      return [
        {
          id: 'seo-canonical-status-cross-origin',
          title: "Canonical URL's response status can't be verified from this page",
          detail: "It points to another origin — reading its status would need a CORS-permissive response from that server, which can't be assumed.",
          severity: 'idle',
          path: canonicalHref,
        },
      ];
    default:
      return [];
  }
}

export function evaluateSeo(raw: SeoRawData): Finding[] {
  const findings: Finding[] = [];

  if (!raw.canonicalHref) {
    findings.push({
      id: 'seo-canonical-missing',
      title: 'Missing canonical URL',
      detail: 'Search engines may index duplicate URLs for this page without one.',
      severity: 'warning',
      path: 'head > link[rel="canonical"]',
    });
  } else {
    const isAbsolute = /^https?:\/\//i.test(raw.canonicalHref);
    let resolved: URL | null = null;
    try {
      resolved = new URL(raw.canonicalHref, raw.currentUrl);
    } catch {
      resolved = null;
    }
    if (!resolved) {
      findings.push({
        id: 'seo-canonical-invalid',
        title: 'Canonical URL is invalid',
        detail: `"${raw.canonicalHref}" could not be parsed as a URL.`,
        severity: 'critical',
        path: raw.canonicalHref,
      });
    } else if (!isAbsolute) {
      findings.push({
        id: 'seo-canonical-relative',
        title: 'Canonical URL is not absolute',
        detail: 'Canonical links should be a full https:// URL, not a relative path.',
        severity: 'warning',
        path: raw.canonicalHref,
      });
    } else {
      const current = new URL(raw.currentUrl);
      if (resolved.origin + resolved.pathname !== current.origin + current.pathname) {
        findings.push({
          id: 'seo-canonical-mismatch',
          title: 'Canonical URL points elsewhere',
          detail: 'This may be intentional (syndicated content) — confirm it is not a mistake.',
          severity: 'idle',
          path: resolved.href,
        });
      }
    }
  }

  if (!raw.title) {
    findings.push({
      id: 'seo-title-missing',
      title: 'Missing page title',
      detail: 'Browsers and search results fall back to the bare URL without one.',
      severity: 'critical',
      path: 'head > title',
    });
  } else if (raw.title.length > 60) {
    findings.push({
      id: 'seo-title-long',
      title: 'Title tag is long',
      detail: 'Search results generally truncate titles beyond ~60 characters.',
      severity: 'warning',
      measured: `${raw.title.length} chars`,
      allowed: '≤60 chars',
      path: raw.title,
    });
  } else if (raw.title.length < 10) {
    findings.push({
      id: 'seo-title-short',
      title: 'Title tag is very short',
      detail: 'A short title gives search engines little to work with.',
      severity: 'warning',
      measured: `${raw.title.length} chars`,
      path: raw.title,
    });
  } else {
    findings.push({
      id: 'seo-title-present',
      title: 'Title tag is present',
      detail: `${raw.title.length} characters — within the recommended range.`,
      severity: 'normal',
      path: raw.title,
    });
  }

  if (!raw.metaDescription) {
    findings.push({
      id: 'seo-description-missing',
      title: 'Meta description missing',
      detail: 'Search results will fall back to scraped body copy.',
      severity: 'warning',
      path: 'head > meta[name="description"]',
    });
  } else if (raw.metaDescription.length > 160) {
    findings.push({
      id: 'seo-description-long',
      title: 'Meta description is long',
      detail: 'Search results generally truncate descriptions beyond ~160 characters.',
      severity: 'warning',
      measured: `${raw.metaDescription.length} chars`,
      allowed: '≤160 chars',
    });
  } else if (raw.metaDescription.length < 50) {
    findings.push({
      id: 'seo-description-short',
      title: 'Meta description is short',
      detail: 'A longer description gives search engines more to show.',
      severity: 'warning',
      measured: `${raw.metaDescription.length} chars`,
      allowed: '50-160 chars',
    });
  } else {
    findings.push({
      id: 'seo-description-present',
      title: 'Meta description is present',
      detail: `${raw.metaDescription.length} characters — within the recommended range.`,
      severity: 'normal',
    });
  }

  if (!raw.viewportPresent) {
    findings.push({
      id: 'seo-viewport-missing',
      title: 'Missing viewport meta tag',
      detail: 'Mobile browsers will render at desktop width and scale down without one.',
      severity: 'warning',
      path: 'head > meta[name="viewport"]',
    });
  }

  if (raw.robotsContent && /noindex/i.test(raw.robotsContent)) {
    findings.push({
      id: 'seo-noindex',
      title: 'Page is marked noindex',
      detail: 'Search engines will not index this page. Confirm this is intentional.',
      severity: 'warning',
      path: `meta[name="robots"] content="${raw.robotsContent}"`,
    });
  }

  findings.push(...checkSpelling(raw.textNodes));

  return findings;
}
