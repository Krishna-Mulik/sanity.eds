// Site-wide aem.live limits that don't live on this one page: the
// ref--repo--owner identity (readable straight off the .aem.page/.aem.live
// hostname — no API needed), the sitemap's page count/size, and the
// redirects table's row count (both fetched same-origin from their
// conventional EDS paths). GitHub Code Sync file/size-per-ref limits and
// Admin API rate limits still need real API access this plugin doesn't
// have — those stay explicit "not checkable" notes rather than a guess.
import type { Finding } from '../../data/types';
import { formatBytes, relativizeUrl } from '../format';
import { PAYLOAD_MAX } from './limits';

export type PreviewHost = 'aem.page' | 'aem.live' | 'hlx.page' | 'hlx.live';

export interface GithubRefInfo {
  matched: boolean;
  ref?: string;
  repo?: string;
  owner?: string;
  combined?: string;
  host?: PreviewHost;
}

// <ref>--<repo>--<owner>.aem.page (or .aem.live / legacy .hlx.page/.hlx.live).
const HOST_PATTERN = /^([a-z0-9-]+)--([a-z0-9-]+)--([a-z0-9-]+)\.(aem\.page|aem\.live|hlx\.page|hlx\.live)$/i;

export function gatherGithubRef(win: Window = window): GithubRefInfo {
  const match = win.location.hostname.match(HOST_PATTERN);
  if (!match) return { matched: false };
  const [, ref, repo, owner, host] = match;
  return { matched: true, ref, repo, owner, combined: `${ref}--${repo}--${owner}`, host: host.toLowerCase() as PreviewHost };
}

export interface SitemapInfo {
  found: boolean;
  url?: string;
  bytes?: number;
  pageCount?: number;
}

export interface RedirectsInfo {
  found: boolean;
  url?: string;
  count?: number;
}

async function fetchText(url: string, timeoutMs: number): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function gatherSitemap(doc: Document = document, win: Window = window): Promise<SitemapInfo> {
  const linkHref = doc.querySelector<HTMLLinkElement>('link[rel="sitemap"]')?.href;
  const fallback = new URL('/sitemap.xml', win.location.origin).href;
  const candidates = linkHref ? [linkHref, fallback] : [fallback];

  for (const url of candidates) {
    const text = await fetchText(url, 5000);
    // A 200 response isn't proof it's a real sitemap — a dev server or a
    // catch-all reverse proxy can return 200 with an unrelated fallback
    // page for any unmatched path, which would otherwise silently read as
    // "found, 0 pages" instead of a clean "not found".
    if (text == null || !/<urlset|<sitemapindex/i.test(text)) continue;
    const pageCount = (text.match(/<loc>/gi) || []).length;
    return { found: true, url: relativizeUrl(url, win.location.origin), bytes: new Blob([text]).size, pageCount };
  }
  return { found: false };
}

export async function gatherRedirects(win: Window = window): Promise<RedirectsInfo> {
  const url = new URL('/redirects.json', win.location.origin).href;
  const text = await fetchText(url, 5000);
  if (text == null) return { found: false };
  try {
    const data = JSON.parse(text);
    const rows = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
    return { found: true, url: relativizeUrl(url, win.location.origin), count: rows.length };
  } catch {
    return { found: false };
  }
}

export interface RobotsInfo {
  found: boolean;
  url?: string;
  sitemapUrls: string[];
  disallowsAll: boolean;
}

/** Pure: parses robots.txt content for Sitemap directives and a blanket "User-agent: * / Disallow: /". */
export function parseRobotsTxt(content: string): { sitemapUrls: string[]; disallowsAll: boolean } {
  const sitemapUrls: string[] = [];
  let disallowsAll = false;
  let currentIsWildcard = false;
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const sep = line.indexOf(':');
    if (sep === -1) continue;
    const key = line.slice(0, sep).trim().toLowerCase();
    const value = line.slice(sep + 1).trim();
    if (key === 'user-agent') currentIsWildcard = value === '*';
    else if (key === 'sitemap' && value) sitemapUrls.push(value);
    else if (key === 'disallow' && currentIsWildcard && value === '/') disallowsAll = true;
  }
  return { sitemapUrls, disallowsAll };
}

export async function gatherRobots(win: Window = window): Promise<RobotsInfo> {
  const url = new URL('/robots.txt', win.location.origin).href;
  const text = await fetchText(url, 5000);
  // Same false-positive shape as the sitemap/JSON-sheet checks: a 200 with
  // no real robots directives (e.g. a dev server's HTML fallback) isn't a
  // real robots.txt.
  if (text == null || !/user-agent/i.test(text)) return { found: false, sitemapUrls: [], disallowsAll: false };
  const { sitemapUrls, disallowsAll } = parseRobotsTxt(text);
  return { found: true, url: relativizeUrl(url, win.location.origin), sitemapUrls, disallowsAll };
}

export interface NotFoundInfo {
  checked: boolean;
  status: number | null;
}

/** Requests a deliberately nonexistent path and records its status — proves whether the site actually 404s. */
export async function gatherNotFoundCheck(win: Window = window): Promise<NotFoundInfo> {
  const probePath = `/sanity-404-probe-${Math.random().toString(36).slice(2)}`;
  const url = new URL(probePath, win.location.origin).href;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    return { checked: true, status: res.status };
  } catch {
    return { checked: false, status: null };
  } finally {
    clearTimeout(timer);
  }
}

export interface JsonSheetInfo {
  found: boolean;
  url?: string;
  bytes?: number;
  /** Row count of the sheet's `data` array, when the JSON follows the EDS sheet shape. */
  rowCount?: number;
}

async function fetchJsonSheet(url: string, timeoutMs: number): Promise<{ bytes: number; rowCount?: number } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    if (!res.ok) return null;
    const text = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      // A 200 with unparseable body isn't a real JSON sheet — e.g. a dev
      // server or catch-all proxy returning its HTML fallback for an
      // unmatched path. Same false-positive shape as the sitemap check.
      return null;
    }
    const contentLength = res.headers.get('content-length');
    const bytes = contentLength ? Number(contentLength) : new Blob([text]).size;
    const rows = Array.isArray((data as { data?: unknown })?.data) ? (data as { data: unknown[] }).data : Array.isArray(data) ? (data as unknown[]) : null;
    return { bytes, rowCount: rows ? rows.length : undefined };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Fetches a conventional EDS content-source JSON sheet (query-index.json, metadata.json, placeholders.json) same-origin. */
export async function gatherJsonSheet(path: string, win: Window = window): Promise<JsonSheetInfo> {
  const url = new URL(path, win.location.origin).href;
  const displayUrl = relativizeUrl(url, win.location.origin);
  const fetched = await fetchJsonSheet(url, 5000);
  if (!fetched) return { found: false, url: displayUrl };
  return { found: true, url: displayUrl, bytes: fetched.bytes, rowCount: fetched.rowCount };
}

export interface JsonSheets {
  queryIndex: JsonSheetInfo;
  metadata: JsonSheetInfo;
  placeholders: JsonSheetInfo;
}

const NOT_FOUND_SHEETS: JsonSheets = { queryIndex: { found: false }, metadata: { found: false }, placeholders: { found: false } };
const NOT_FOUND_ROBOTS: RobotsInfo = { found: false, sitemapUrls: [], disallowsAll: false };
const NOT_CHECKED_404: NotFoundInfo = { checked: false, status: null };

const REF_MAX = 63;
const NAME_PATTERN = /^[a-z0-9-]+$/;
const SITEMAP_PAGE_MAX = 50_000;
const SITEMAP_BYTES_MAX = 50 * 1024 * 1024;
const REDIRECTS_MAX = 100_000;
const QUERY_INDEX_PAGE_MAX = 50_000;
const SITE_PAGE_RECOMMENDED_MAX = 1_000_000;

export function evaluateSiteLimits(
  ref: GithubRefInfo,
  sitemap: SitemapInfo,
  redirects: RedirectsInfo,
  jsonSheets: JsonSheets = NOT_FOUND_SHEETS,
  robots: RobotsInfo = NOT_FOUND_ROBOTS,
  notFound: NotFoundInfo = NOT_CHECKED_404,
): Finding[] {
  const findings: Finding[] = [];

  if (ref.matched && ref.combined) {
    if (ref.combined.length > REF_MAX) {
      findings.push({
        id: 'site-ref-length',
        title: 'ref--repo--owner exceeds the 63-character hostname limit',
        detail: `"${ref.combined}" won't resolve as a valid preview/live hostname.`,
        severity: 'critical',
        measured: `${ref.combined.length} chars`,
        allowed: `${REF_MAX} chars`,
      });
    }
    const badParts = [ref.ref, ref.repo, ref.owner].filter((part): part is string => typeof part === 'string' && !NAME_PATTERN.test(part));
    if (badParts.length) {
      findings.push({
        id: 'site-ref-naming',
        title: 'GitHub ref/repo/owner contains disallowed characters',
        detail: `"${badParts.join('", "')}" — only lowercase letters, numbers, and dashes are allowed.`,
        severity: 'critical',
      });
    }
  } else {
    findings.push({
      id: 'site-ref-unknown',
      title: 'GitHub ref/repo/owner not derivable from this URL',
      detail: "This page isn't on a standard aem.page/aem.live preview or live host (likely a custom domain), so the source ref/repo/owner can't be read from the URL.",
      severity: 'idle',
    });
  }

  if (sitemap.found) {
    if (sitemap.pageCount != null && sitemap.pageCount > SITEMAP_PAGE_MAX) {
      findings.push({
        id: 'site-sitemap-pages',
        title: 'Sitemap has grown past 50k pages',
        detail: 'Individual sitemaps and search indices cannot grow beyond 50,000 pages.',
        severity: 'critical',
        path: sitemap.url,
        measured: `${sitemap.pageCount} pages`,
        allowed: `${SITEMAP_PAGE_MAX.toLocaleString()} pages`,
      });
    }
    if (sitemap.bytes != null && sitemap.bytes > SITEMAP_BYTES_MAX) {
      findings.push({
        id: 'site-sitemap-size',
        title: 'Sitemap has grown past 50MB',
        detail: 'Individual sitemaps cannot grow beyond 50MB.',
        severity: 'critical',
        path: sitemap.url,
        measured: formatBytes(sitemap.bytes),
        allowed: formatBytes(SITEMAP_BYTES_MAX),
      });
    }
  } else {
    findings.push({
      id: 'site-sitemap-not-found',
      title: 'No sitemap found at /sitemap.xml',
      detail: "Not necessarily a problem — many sites don't publish one, or publish it elsewhere this scan didn't check.",
      severity: 'idle',
    });
  }

  if (redirects.found) {
    if (redirects.count != null && redirects.count > REDIRECTS_MAX) {
      findings.push({
        id: 'site-redirects',
        title: 'Redirects table has grown past 100k entries',
        detail: 'Redirects per site cannot exceed 100,000 entries.',
        severity: 'critical',
        path: redirects.url,
        measured: `${redirects.count} redirects`,
        allowed: `${REDIRECTS_MAX.toLocaleString()} redirects`,
      });
    }
  } else {
    findings.push({
      id: 'site-redirects-not-found',
      title: 'No redirects.json found',
      detail: 'The common case for a site with no configured redirects — not necessarily a problem.',
      severity: 'idle',
    });
  }

  if (!robots.found) {
    findings.push({
      id: 'site-robots-not-found',
      title: 'No robots.txt found',
      detail: 'Not required, but the go-live checklist recommends one so crawlers can discover /sitemap.xml directly ("Sitemap: https://<your-domain>/sitemap.xml") rather than relying on submission alone.',
      severity: 'warning',
    });
  } else {
    if (robots.disallowsAll) {
      findings.push({
        id: 'site-robots-disallow-all',
        title: 'robots.txt blocks all crawlers',
        detail: '"Disallow: /" under "User-agent: *" excludes the entire site from indexing. If this is only meant to hide a preview/staging domain, note that aem.page/aem.live are already hidden from crawlers by the platform itself — this same file also applies once pointed at your production domain.',
        severity: 'critical',
        path: robots.url,
      });
    }
    if (robots.sitemapUrls.length === 0) {
      findings.push({
        id: 'site-robots-sitemap-missing',
        title: "robots.txt doesn't reference a sitemap",
        detail: 'Add "Sitemap: https://<your-domain>/sitemap.xml" so crawlers can discover it directly instead of relying on submission alone.',
        severity: 'warning',
        path: robots.url,
      });
    }
  }

  if (notFound.checked) {
    if (notFound.status !== 404) {
      findings.push({
        id: 'site-404-status',
        title: `Nonexistent pages return HTTP ${notFound.status}, not 404`,
        detail: 'A request to a random path that should not exist did not come back as a 404. Search engines and monitoring tools rely on a real 404 status to know a page is actually gone — a false 200 can get broken or removed URLs silently indexed as valid content.',
        severity: 'warning',
      });
    }
  } else {
    findings.push({
      id: 'site-404-not-checkable',
      title: "Could not verify this site's 404 behavior",
      detail: 'The request to a deliberately nonexistent path failed outright rather than returning a clear status.',
      severity: 'idle',
    });
  }

  const { queryIndex, metadata, placeholders } = jsonSheets;

  if (queryIndex.found) {
    if (queryIndex.rowCount != null && queryIndex.rowCount > QUERY_INDEX_PAGE_MAX) {
      findings.push({
        id: 'site-query-index-pages',
        title: 'Query index has grown past 50k pages',
        detail: 'A single query index is capped at 50,000 pages to avoid reindexing slowdowns — split content across multiple indexes for different content areas.',
        severity: 'critical',
        path: queryIndex.url,
        measured: `${queryIndex.rowCount.toLocaleString()} pages`,
        allowed: `${QUERY_INDEX_PAGE_MAX.toLocaleString()} pages`,
      });
    } else if (queryIndex.rowCount != null && queryIndex.rowCount > QUERY_INDEX_PAGE_MAX * 0.85) {
      findings.push({
        id: 'site-query-index-pages-warn',
        title: 'Query index is nearing the 50k page capacity',
        detail: 'Approaching the point where reindexing slows down and the JSON payload needs pagination logic.',
        severity: 'warning',
        path: queryIndex.url,
        measured: `${queryIndex.rowCount.toLocaleString()} pages`,
        allowed: `${QUERY_INDEX_PAGE_MAX.toLocaleString()} pages`,
      });
    }
    if (queryIndex.bytes != null && queryIndex.bytes > PAYLOAD_MAX) {
      findings.push({
        id: 'site-query-index-payload',
        title: 'query-index.json exceeds the 6MB response payload limit',
        detail: 'This is the exact resource that will fail to serve once a JSON response goes over the compressed payload cap.',
        severity: 'critical',
        path: queryIndex.url,
        measured: formatBytes(queryIndex.bytes),
        allowed: formatBytes(PAYLOAD_MAX),
      });
    } else if (queryIndex.bytes != null && queryIndex.bytes > PAYLOAD_MAX * 0.85) {
      findings.push({
        id: 'site-query-index-payload-warn',
        title: 'query-index.json is nearing the 6MB payload limit',
        detail: 'Getting close to the compressed response cap for JSON sheets.',
        severity: 'warning',
        path: queryIndex.url,
        measured: formatBytes(queryIndex.bytes),
        allowed: formatBytes(PAYLOAD_MAX),
      });
    }
  } else {
    findings.push({
      id: 'site-query-index-not-found',
      title: 'No query index found at /query-index.json',
      detail: "Not necessarily a problem for a small site, but most production EDS sites define one — it's what powers search, nav, and sitemap generation.",
      severity: 'idle',
    });
  }

  if (metadata.found && metadata.bytes != null) {
    if (metadata.bytes > PAYLOAD_MAX) {
      findings.push({
        id: 'site-metadata-payload',
        title: 'metadata.json exceeds the 6MB response payload limit',
        detail: 'The metadata sheet is served as a JSON response like any other — an oversized sheet fails the same compressed-payload cap.',
        severity: 'critical',
        path: metadata.url,
        measured: formatBytes(metadata.bytes),
        allowed: formatBytes(PAYLOAD_MAX),
      });
    } else if (metadata.bytes > PAYLOAD_MAX * 0.85) {
      findings.push({
        id: 'site-metadata-payload-warn',
        title: 'metadata.json is nearing the 6MB payload limit',
        detail: 'Getting close to the compressed response cap. Large sites typically split per-section metadata sheets before hitting this.',
        severity: 'warning',
        path: metadata.url,
        measured: formatBytes(metadata.bytes),
        allowed: formatBytes(PAYLOAD_MAX),
      });
    }
  } else if (!metadata.found) {
    findings.push({
      id: 'site-metadata-not-found',
      title: 'No metadata sheet found at /metadata.json',
      detail: 'Not necessarily a problem — some sites drive per-page metadata from page content or block config instead.',
      severity: 'idle',
    });
  }

  if (placeholders.found && placeholders.bytes != null) {
    if (placeholders.bytes > PAYLOAD_MAX) {
      findings.push({
        id: 'site-placeholders-payload',
        title: 'placeholders.json exceeds the 6MB response payload limit',
        detail: 'Unusual for a UI-strings sheet to reach this size — worth checking what got added to it.',
        severity: 'critical',
        path: placeholders.url,
        measured: formatBytes(placeholders.bytes),
        allowed: formatBytes(PAYLOAD_MAX),
      });
    }
  } else {
    findings.push({
      id: 'site-placeholders-not-found',
      title: 'No placeholders sheet found at /placeholders.json',
      detail: 'Not necessarily a problem — only needed for shared UI strings or localization.',
      severity: 'idle',
    });
  }

  const pageSignal = Math.max(sitemap.pageCount ?? 0, queryIndex.rowCount ?? 0);
  if (pageSignal > SITE_PAGE_RECOMMENDED_MAX * 0.8) {
    findings.push({
      id: 'site-pages-approaching-max',
      title: 'Site is approaching the recommended maximum of 1M pages',
      detail: 'Past this scale, aem.live recommends splitting into multiple repoless sites that share a codebase rather than growing a single site further.',
      severity: 'warning',
      measured: `${pageSignal.toLocaleString()} pages`,
      allowed: `${SITE_PAGE_RECOMMENDED_MAX.toLocaleString()} pages (recommended max)`,
    });
  }

  findings.push({
    id: 'site-json-sheets-scope',
    title: 'Only the conventional top-level JSON sheets are checked',
    detail: 'query-index.json, metadata.json, and placeholders.json are covered. Locale-nested, per-section, or custom-named sheets (e.g. /en/query-index.json) are not automatically discoverable from a single page scan.',
    severity: 'idle',
  });

  findings.push({
    id: 'site-code-sync-not-checkable',
    title: 'GitHub Code Sync file-count and size-per-ref limits are not checkable from this page',
    detail: '500 files and 10MB per ref, 100 active refs, 6-month inactive-branch retention — these need GitHub API access this in-page scan does not have.',
    severity: 'idle',
  });

  findings.push({
    id: 'site-admin-api-not-checkable',
    title: 'Admin API rate limits are not checkable from this page',
    detail: '10 requests/second per project, 500 max pending bulk-API jobs — these need an Admin API token this plugin does not have.',
    severity: 'idle',
  });

  findings.push({
    id: 'site-byom-not-checkable',
    title: 'BYOM content source limits are not checkable from this page',
    detail: "Whether this site even uses a Bring-Your-Own-Markup content source is a repo-config fact this in-page scan can't see, let alone that source's own response times or image counts.",
    severity: 'idle',
  });

  return findings;
}
