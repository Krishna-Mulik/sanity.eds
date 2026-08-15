// Client-observable subset of the published aem.live delivery limits
// (https://www.aem.live/docs/limits). Page/asset-level checks live here;
// site-wide checks (sitemap, redirects, GitHub ref/repo/owner) live in
// siteLimits.ts since they need their own same-origin fetches independent
// of anything on this page. Every limit category from the docs gets either
// a real check or its own explicitly labeled "not checkable, and why" note
// — never one vague blanket disclaimer.
//
// Asset size and file-type caps only apply to same-origin assets: aem.live's
// content-bus rules govern assets delivered through the EDS content source,
// which are always served from the page's own origin. A cross-origin
// fetch() to read Content-Length would also just fail (or silently zero out
// via Resource Timing's Timing-Allow-Origin restriction) for any
// third-party host that doesn't opt in — so those are explicitly out of
// scope, not silently mismeasured as "fine".
import type { Finding } from '../../data/types';
import type { LinkInfo } from './links';
import { formatBytes, relativizeUrl } from '../format';
import { buildSelector } from '../selector';

export type LimitAssetKind = 'image' | 'svg' | 'video' | 'favicon' | 'pdf';

export interface LimitAsset {
  path: string;
  kind: LimitAssetKind;
  /** null = same-origin but its size could not be measured. */
  bytes: number | null;
  selector?: string;
}

export interface LongLinkPath {
  href: string;
  length: number;
  selector: string;
}

export interface LimitsRawData {
  pathLength: number;
  payloadBytes: number | null;
  redirectCount: number;
  assets: LimitAsset[];
  /** Same-origin-only assets found but hosted elsewhere, so out of scope for this check. */
  skippedCrossOrigin: number;
  /** Internal links whose own path also exceeds the 900-char document-path limit. */
  longLinkPaths: LongLinkPath[];
}

const PATH_MAX = 900;
// Exported: also the cap for the conventional JSON sheets (query-index,
// metadata, placeholders) checked in siteLimits.ts — same "6MB compressed
// response" rule from the docs, just a different resource than the page itself.
export const PAYLOAD_MAX = 6 * 1024 * 1024;

const CAPS: Record<LimitAssetKind, number> = {
  image: 20 * 1024 * 1024,
  svg: 40 * 1024,
  video: 36 * 1024 * 1024,
  favicon: 16 * 1024,
  pdf: 20 * 1024 * 1024,
};

const LABELS: Record<LimitAssetKind, string> = {
  image: 'Image',
  svg: 'SVG',
  video: 'Video',
  favicon: 'Favicon',
  pdf: 'PDF',
};

// "Supported File Types" per aem.live/docs/limits: HTML (extension-less),
// JSON, MP4, PDF, SVG, JPG, PNG, AVIF and WEBP. Favicons (.ico) are a
// separately documented content-source type, checked on their own above —
// excluded here so they aren't double-flagged as "unsupported".
const SUPPORTED_EXTENSIONS = new Set(['json', 'mp4', 'pdf', 'svg', 'jpg', 'jpeg', 'png', 'avif', 'webp']);

interface AssetCandidate {
  path: string;
  kind: LimitAssetKind;
  selector?: string;
}

function extensionOf(url: string): string | null {
  const match = url.split(/[?#]/)[0].match(/\.([a-z0-9]+)$/i);
  return match ? match[1].toLowerCase() : null;
}

async function measureBytes(url: string, resources: PerformanceResourceTiming[]): Promise<number | null> {
  const entry = resources.find((r) => r.name === url);
  const fromTiming = entry ? entry.encodedBodySize || entry.transferSize || 0 : 0;
  if (fromTiming > 0) return fromTiming;
  // Same-origin only (callers filter for this): a live HEAD's Content-Length
  // is authoritative and doesn't depend on Resource Timing's buffer/history.
  try {
    const res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    const len = res.headers.get('content-length');
    return len ? Number(len) : null;
  } catch {
    return null;
  }
}

function collectCandidates(doc: Document): AssetCandidate[] {
  const candidates: AssetCandidate[] = [];

  doc.querySelectorAll('img[src]').forEach((el) => {
    const img = el as HTMLImageElement;
    const url = img.currentSrc || img.src;
    if (!url) return;
    const isSvg = /\.svg(\?|#|$)/i.test(url);
    candidates.push({ path: url, kind: isSvg ? 'svg' : 'image', selector: buildSelector(img) });
  });

  doc.querySelectorAll('video[src], video source[src]').forEach((el) => {
    const src = el.getAttribute('src');
    if (!src) return;
    let url: string;
    try {
      url = new URL(src, doc.baseURI).href;
    } catch {
      return;
    }
    candidates.push({ path: url, kind: 'video', selector: buildSelector(el) });
  });

  doc.querySelectorAll('a[href$=".pdf" i]').forEach((el) => {
    const href = el.getAttribute('href');
    if (!href) return;
    let url: string;
    try {
      url = new URL(href, doc.baseURI).href;
    } catch {
      return;
    }
    candidates.push({ path: url, kind: 'pdf', selector: buildSelector(el) });
  });

  const iconLink = doc.querySelector<HTMLLinkElement>('link[rel~="icon"]');
  if (iconLink?.href) candidates.push({ path: iconLink.href, kind: 'favicon' });

  return candidates;
}

export async function gatherLimits(doc: Document = document, win: Window = window, linkInfos: LinkInfo[] = []): Promise<LimitsRawData> {
  const nav = win.performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  const resources = win.performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  const origin = win.location.origin;

  const candidates = collectCandidates(doc);
  const sameOrigin = candidates.filter((c) => {
    try {
      return new URL(c.path).origin === origin;
    } catch {
      return false;
    }
  });

  const measured = await Promise.all(sameOrigin.map((c) => measureBytes(c.path, resources)));
  // Every candidate here is already same-origin (filtered above), so it's
  // always safe to drop the domain for display — this site's own content
  // doesn't need this site's own domain repeated in front of it.
  const assets: LimitAsset[] = sameOrigin.map((c, i) => ({ ...c, path: relativizeUrl(c.path, origin), bytes: measured[i] }));

  const longLinkPaths: LongLinkPath[] = linkInfos
    .filter((l) => l.internal && l.url && l.url.pathname.length > PATH_MAX)
    .map((l) => ({ href: relativizeUrl(l.url!.href, origin), length: l.url!.pathname.length, selector: l.selector }));

  return {
    pathLength: win.location.pathname.length,
    payloadBytes: nav ? nav.encodedBodySize || nav.transferSize || null : null,
    redirectCount: nav?.redirectCount ?? 0,
    assets,
    skippedCrossOrigin: candidates.length - sameOrigin.length,
    longLinkPaths,
  };
}

export function evaluateLimits(raw: LimitsRawData): Finding[] {
  const findings: Finding[] = [];

  if (raw.pathLength > PATH_MAX) {
    findings.push({
      id: 'limits-path-length',
      title: 'Document path over the length limit',
      detail: 'aem.live rejects document paths longer than 900 characters.',
      severity: 'critical',
      measured: `${raw.pathLength} chars`,
      allowed: `${PATH_MAX} chars`,
    });
  }

  for (const link of raw.longLinkPaths) {
    findings.push({
      id: `limits-link-path-${link.href}`,
      title: 'Linked page path over the length limit',
      detail: 'A page this one links to has a path longer than 900 characters and will not publish.',
      severity: 'critical',
      path: link.href,
      targetSelector: link.selector,
      measured: `${link.length} chars`,
      allowed: `${PATH_MAX} chars`,
    });
  }

  if (raw.payloadBytes != null) {
    if (raw.payloadBytes > PAYLOAD_MAX) {
      findings.push({
        id: 'limits-payload',
        title: 'Page response over the payload limit',
        detail: 'Total response payload (especially large JSON like metadata sheets or query indices) may not exceed 6MB compressed.',
        severity: 'critical',
        measured: formatBytes(raw.payloadBytes),
        allowed: formatBytes(PAYLOAD_MAX),
      });
    } else if (raw.payloadBytes > PAYLOAD_MAX * 0.85) {
      findings.push({
        id: 'limits-payload-warn',
        title: 'Page response nearing the payload limit',
        detail: 'The compressed response is approaching the 6MB delivery cap.',
        severity: 'warning',
        measured: formatBytes(raw.payloadBytes),
        allowed: formatBytes(PAYLOAD_MAX),
      });
    }
  }

  for (const asset of raw.assets) {
    const extension = extensionOf(asset.path);
    if (asset.kind !== 'favicon' && extension && !SUPPORTED_EXTENSIONS.has(extension)) {
      findings.push({
        id: `limits-unsupported-type-${asset.path}`,
        title: `Unsupported file type: .${extension}`,
        detail: 'aem.live only delivers HTML, JSON, MP4, PDF, SVG, JPG, PNG, AVIF and WEBP — this asset is outside that list and the content bus will reject it.',
        severity: 'critical',
        path: asset.path,
        targetSelector: asset.selector,
      });
    }

    if (asset.bytes == null) continue;
    const cap = CAPS[asset.kind];
    if (asset.bytes > cap) {
      findings.push({
        id: `limits-asset-${asset.path}`,
        title: `${LABELS[asset.kind]} over the size limit`,
        detail: 'Oversized assets are rejected by the content bus and will not publish — this is the exact file causing that failure.',
        severity: 'critical',
        path: asset.path,
        targetSelector: asset.selector,
        measured: formatBytes(asset.bytes),
        allowed: formatBytes(cap),
      });
    } else if (asset.bytes > cap * 0.85) {
      findings.push({
        id: `limits-asset-warn-${asset.path}`,
        title: `${LABELS[asset.kind]} nearing the size limit`,
        detail: 'Getting close to the content bus size cap for this asset type.',
        severity: 'warning',
        path: asset.path,
        targetSelector: asset.selector,
        measured: formatBytes(asset.bytes),
        allowed: formatBytes(cap),
      });
    }
  }

  if (raw.redirectCount > 1) {
    findings.push({
      id: 'limits-redirects',
      title: 'Multiple redirects on this navigation',
      detail: `This page loaded after ${raw.redirectCount} redirects, adding round trips before content can render.`,
      severity: 'warning',
      measured: String(raw.redirectCount),
      allowed: '0-1',
    });
  }

  if (raw.skippedCrossOrigin > 0) {
    findings.push({
      id: 'limits-cross-origin-skipped',
      title: `${raw.skippedCrossOrigin} media asset${raw.skippedCrossOrigin > 1 ? 's' : ''} hosted on another origin`,
      detail: "Size and file type can't be read from this page for a cross-origin asset — but aem.live's content-bus limits only apply to same-origin content-source assets anyway, so these are out of scope by definition, not unchecked.",
      severity: 'idle',
    });
  }

  findings.push({
    id: 'limits-docs-not-checkable',
    title: 'Document (.docx/gdoc) and spreadsheet size limits are not checkable from this page',
    detail: '100MB per document; spreadsheets up to 100k rows / 500k cells — these apply to the authored source file, which is not visible from the delivered page.',
    severity: 'idle',
  });

  return findings;
}
