// Favicon check: verifies an actual icon resolves (not a 404/dead URL),
// not just that a <link> tag exists — a generic meta-tag inspector only
// ever sees the <link>, never whether the resource behind it loads.
//
// An explicit <link rel="icon"> is NOT required for this to work: EDS's
// default boilerplate ships a real /favicon.ico but adds no <link> tag for
// it at all, relying entirely on the browser's own implicit convention of
// requesting /favicon.ico when no <link> is present — confirmed against a
// real deployed site (no "icon" anywhere in its <head>, but /favicon.ico
// itself resolves with a real 200 image/vnd.microsoft.icon). The old
// version of this check only ever looked at the <link>, so it flagged that
// perfectly working, convention-only setup as "missing" — a false
// positive on the common case, not the exception. So the URL actually
// probed is the explicit <link> when present, else the conventional
// same-origin /favicon.ico path — the same fallback a browser itself uses.
//
// Probed with an Image() load, same technique used for og:image
// (social.ts) and for the same reason: a fetch() would false-positive
// "broken" on a perfectly valid cross-origin/CDN-hosted favicon that a
// browser loads without needing CORS headers at all.
import type { Finding } from '../../data/types';
import { relativizeUrl } from '../format';

const CONVENTIONAL_FAVICON_PATH = '/favicon.ico';

export interface FaviconRawData {
  faviconHref: string | null;
}

export function gatherFaviconLink(doc: Document = document): FaviconRawData {
  return {
    faviconHref: doc.querySelector<HTMLLinkElement>('link[rel~="icon"]')?.href || null,
  };
}

/** The explicit <link> href when present, else the conventional same-origin /favicon.ico. */
export function resolveFaviconUrl(raw: FaviconRawData, origin: string): string {
  return raw.faviconHref || `${origin}${CONVENTIONAL_FAVICON_PATH}`;
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

/** Whether some usable favicon resolves — explicit <link>, or the conventional /favicon.ico fallback. */
export async function checkFavicon(raw: FaviconRawData, origin: string): Promise<boolean> {
  return probeImageLoads(resolveFaviconUrl(raw, origin));
}

export function evaluateFavicon(raw: FaviconRawData, faviconLoaded: boolean, origin = ''): Finding[] {
  if (faviconLoaded) return [];

  const checkedUrl = resolveFaviconUrl(raw, origin);
  return [
    {
      id: 'seo-favicon-missing',
      title: raw.faviconHref ? 'Favicon link is broken' : 'No favicon found',
      detail: raw.faviconHref
        ? "The linked favicon failed to load — it 404s, the URL is wrong, or the file isn't a valid image."
        : 'No <link rel="icon"> tag, and the conventional /favicon.ico path browsers fall back to doesn\'t resolve either — browsers will show no icon for this page.',
      severity: raw.faviconHref ? 'critical' : 'warning',
      path: relativizeUrl(checkedUrl, origin),
    },
  ];
}
