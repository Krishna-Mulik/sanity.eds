// Core Web Vitals via PerformanceObserver (buffered, so entries recorded
// before Sanity mounted are still picked up), plus render-blocking
// resources, oversized bundles, and duplicate requests from Resource
// Timing. CWV values are provisional mid-session measurements — LCP/INP in
// particular can still change after the scan runs — not a final RUM value.
import type { Finding, Metric, RenderBlocker } from '../../data/types';
import type { Severity } from '../severity';
import type { GithubRefInfo } from './siteLimits';
import { buildSelector } from '../selector';
import { formatBytes, relativizeUrl } from '../format';

export interface RawCwv {
  lcp: number | null;
  cls: number | null;
  inp: number | null;
  fcp: number | null;
}

interface LayoutShiftEntry extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}

interface EventTimingEntry extends PerformanceEntry {
  duration: number;
}

function collectBuffered(type: string, waitMs: number): Promise<PerformanceEntry[]> {
  return new Promise((resolve) => {
    const entries: PerformanceEntry[] = [];
    let observer: PerformanceObserver;
    try {
      observer = new PerformanceObserver((list: PerformanceObserverEntryList) => entries.push(...list.getEntries()));
      observer.observe({ type, buffered: true } as PerformanceObserverInit);
    } catch {
      resolve(entries);
      return;
    }
    setTimeout(() => {
      observer.disconnect();
      resolve(entries);
    }, waitMs);
  });
}

export type FormFactor = 'Mobile' | 'Desktop';

/**
 * The CWV grid below is one real measurement from whatever device this scan
 * actually ran on — there's no way to also produce a second, different-
 * device reading from inside that same page session. A lab tool like
 * PageSpeed Insights gets a genuine mobile-vs-desktop pair by running two
 * separate emulated Lighthouse audits (a throttled Moto G Power profile,
 * and an unthrottled desktop one); this scan only ever has the one browser
 * it's actually running in. So rather than silently presenting a single
 * reading as if it applied to both, the grid is labeled with which device
 * it came from — `navigator.userAgentData.mobile` when the browser exposes
 * it (Chromium), else a viewport-width heuristic.
 */
export function classifyFormFactor(viewportWidth: number, isMobileUA?: boolean): FormFactor {
  if (isMobileUA != null) return isMobileUA ? 'Mobile' : 'Desktop';
  return viewportWidth < 768 ? 'Mobile' : 'Desktop';
}

export function gatherFormFactor(win: Window = window): FormFactor {
  const uaData = (win.navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData;
  return classifyFormFactor(win.innerWidth, uaData?.mobile);
}

export async function gatherCwv(): Promise<RawCwv> {
  const [lcpEntries, clsEntries, paintEntries, eventEntries] = await Promise.all([
    collectBuffered('largest-contentful-paint', 200),
    collectBuffered('layout-shift', 400),
    collectBuffered('paint', 200),
    collectBuffered('event', 400),
  ]);

  const lcp = lcpEntries.length ? Math.max(...lcpEntries.map((e) => e.startTime)) : null;
  const cls = clsEntries.length
    ? (clsEntries as unknown as LayoutShiftEntry[]).reduce((sum, e) => sum + (e.hadRecentInput ? 0 : e.value), 0)
    : null;
  const fcpEntry = paintEntries.find((e) => e.name === 'first-contentful-paint');
  const fcp = fcpEntry ? fcpEntry.startTime : null;
  const durations = (eventEntries as unknown as EventTimingEntry[]).map((e) => e.duration);
  const inp = durations.length ? Math.max(...durations) : null;

  return { lcp, cls, inp, fcp };
}

function severityFor(value: number | null, good: number, poor: number): Severity {
  if (value == null) return 'idle';
  if (value <= good) return 'normal';
  if (value <= poor) return 'warning';
  return 'critical';
}

function fmtMs(v: number | null): string {
  if (v == null) return '—';
  return v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${Math.round(v)}ms`;
}

export function evaluateCwv(raw: RawCwv): Metric[] {
  return [
    { id: 'lcp', label: 'LCP', value: fmtMs(raw.lcp), target: '2.5s', severity: severityFor(raw.lcp, 2500, 4000) },
    { id: 'cls', label: 'CLS', value: raw.cls == null ? '—' : raw.cls.toFixed(2), target: '0.1', severity: severityFor(raw.cls, 0.1, 0.25) },
    { id: 'inp', label: 'INP', value: fmtMs(raw.inp), target: '200ms', severity: severityFor(raw.inp, 200, 500) },
    { id: 'fcp', label: 'FCP', value: fmtMs(raw.fcp), target: '1.8s', severity: severityFor(raw.fcp, 1800, 3000) },
  ];
}

const SCORE_WEIGHT: Record<Severity, number> = { normal: 100, warning: 60, critical: 20, idle: 0 };

export function computeScore(cwv: Metric[]): number {
  const counted = cwv.filter((m) => m.severity !== 'idle');
  if (!counted.length) return 0;
  const total = counted.reduce((sum, m) => sum + SCORE_WEIGHT[m.severity], 0);
  return Math.round(total / counted.length);
}

/** The Speed section's own /100 score banner — a different scale from the
 * per-metric CWV severities it's built from, so it needs its own thresholds
 * rather than reusing sectionSeverity: below 90 is red, below 95 is yellow,
 * 95 and up is green. */
export function scoreSeverity(score: number): Severity {
  if (score < 90) return 'critical';
  if (score < 95) return 'warning';
  return 'normal';
}

export interface ResourceInfo {
  name: string;
  initiatorType: string;
  transferSize: number;
  duration: number;
  /** When the resource fully arrived, relative to navigation start — used for the LCP payload-budget check. */
  responseEnd?: number;
  /** When the request began — used for the early-third-party-connection check. */
  startTime?: number;
  origin?: string | null;
  /**
   * The browser's own call on whether this resource blocked first paint
   * (PerformanceResourceTiming.renderBlockingStatus — Chrome-only, not yet
   * in TS's DOM lib, hence the cast at the read site). `undefined` in
   * browsers that don't support the field.
   */
  renderBlockingStatus?: string;
}

// The directory this scan code itself was loaded from — its own bundled
// chunk's URL, e.g. https://example.com/tools/sanity/. A real site visitor
// never fetches this: Sanity only pulls it in lazily, the moment someone
// clicks the Sidekick button (see plugin-entry.ts). Its own footprint
// landing in Resource Timing right as the scan runs — the same window
// these checks measure — would otherwise get graded against the page's own
// performance budget, which is a category error: it's the audit tool's
// weight, not the page's. Derived from import.meta.url rather than a
// hardcoded "/tools/sanity/" guess, since a consumer can install the
// distributable under any path (see README.md).
const SELF_DIR = new URL('.', import.meta.url).href;

export function excludeOwnResources(resources: ResourceInfo[], selfDir: string): ResourceInfo[] {
  return resources.filter((r) => !r.name.startsWith(selfDir));
}

export function gatherResources(win: Window = window): ResourceInfo[] {
  const all = (win.performance.getEntriesByType('resource') as PerformanceResourceTiming[]).map((e) => {
    let origin: string | null = null;
    try {
      origin = new URL(e.name).origin;
    } catch {
      origin = null;
    }
    return {
      name: e.name,
      initiatorType: e.initiatorType,
      transferSize: e.transferSize || e.encodedBodySize || 0,
      duration: e.duration,
      responseEnd: e.responseEnd,
      startTime: e.startTime,
      origin,
      renderBlockingStatus: (e as PerformanceResourceTiming & { renderBlockingStatus?: string }).renderBlockingStatus,
    };
  });
  return excludeOwnResources(all, SELF_DIR);
}

export interface RenderBlockerCandidate {
  path: string;
  selector: string;
  tag: 'script' | 'link';
}

export function gatherRenderBlocking(doc: Document = document): RenderBlockerCandidate[] {
  const blockers: RenderBlockerCandidate[] = [];

  doc.querySelectorAll<HTMLScriptElement>('head script[src]').forEach((el) => {
    if (!el.async && !el.defer && el.type !== 'module') {
      blockers.push({ path: el.src, selector: buildSelector(el), tag: 'script' });
    }
  });

  doc.querySelectorAll<HTMLLinkElement>('head link[rel="stylesheet"]').forEach((el) => {
    if (!el.media || el.media === 'all' || el.media === 'screen') {
      blockers.push({ path: el.href, selector: buildSelector(el), tag: 'link' });
    }
  });

  return blockers;
}

/**
 * `gatherRenderBlocking`'s DOM query only sees a snapshot of <head> at scan
 * time — after the whole page, including every EDS block, has already
 * loaded. `scripts/aem.js`'s loadCSS() appends each block's own stylesheet
 * to <head> as it decorates, long after the page already painted; by scan
 * time those look identical to a stylesheet that was genuinely present in
 * the original markup and blocked first paint. Resource Timing's own
 * `renderBlockingStatus` (Chrome) is the browser's authoritative record of
 * which resources actually blocked rendering, so it's used to narrow the
 * DOM-derived candidates down to the real ones whenever it's available —
 * confirmed against a real EDS page where the DOM heuristic alone flagged 8
 * stylesheets but only 1 (the page's own styles.css) actually blocked
 * anything; the other 7 were per-block CSS added after first paint.
 * Falls back to the DOM heuristic untouched in browsers that don't expose
 * the field (Firefox, Safari) rather than silently reporting nothing.
 */
export function evaluateRenderBlocking(candidates: RenderBlockerCandidate[], resources: ResourceInfo[], pageOrigin = ''): RenderBlocker[] {
  const signalSupported = resources.some((r) => r.renderBlockingStatus != null);
  const actualBlockers = signalSupported
    ? candidates.filter((c) => resources.find((r) => r.name === c.path)?.renderBlockingStatus === 'blocking')
    : candidates;

  return actualBlockers.map((c) => {
    const res = resources.find((r) => r.name === c.path);
    const blockingMs = res ? Math.round(res.duration) : 0;
    return {
      path: relativizeUrl(c.path, pageOrigin),
      blockingMs,
      detail: c.tag === 'script' ? 'Loaded synchronously in the document head.' : 'Blocks rendering until this stylesheet loads.',
      severity: blockingMs > 300 ? 'critical' : blockingMs > 100 ? 'warning' : 'normal',
    };
  });
}

const LARGE_BUNDLE_BYTES = 150 * 1024;

export function evaluateLargeBundles(resources: ResourceInfo[], pageOrigin = ''): Finding[] {
  return resources
    .filter((r) => (r.initiatorType === 'script' || r.initiatorType === 'link' || r.initiatorType === 'css') && r.transferSize > LARGE_BUNDLE_BYTES)
    .map((r) => ({
      id: `perf-large-${r.name}`,
      title: `Large ${r.initiatorType === 'script' ? 'script' : 'stylesheet'} bundle`,
      detail: 'Large bundles delay when the page becomes interactive.',
      severity: r.transferSize > LARGE_BUNDLE_BYTES * 2 ? 'critical' : 'warning',
      path: relativizeUrl(r.name, pageOrigin),
      measured: formatBytes(r.transferSize),
      allowed: formatBytes(LARGE_BUNDLE_BYTES),
    }));
}

export function evaluateDuplicateRequests(resources: ResourceInfo[], pageOrigin = ''): Finding[] {
  const counts = new Map<string, number>();
  for (const r of resources) counts.set(r.name, (counts.get(r.name) || 0) + 1);

  const findings: Finding[] = [];
  for (const [name, count] of counts) {
    if (count > 1) {
      findings.push({
        id: `perf-duplicate-${name}`,
        title: 'Duplicate request',
        detail: `Requested ${count} times during this page load.`,
        severity: 'warning',
        path: relativizeUrl(name, pageOrigin),
      });
    }
  }
  return findings;
}

const LCP_PAYLOAD_BUDGET = 100 * 1024;

const TOP_CONTRIBUTORS_SHOWN = 3;

/**
 * aem.live's "Keeping it 100" guidance: keep total network payload before
 * the LCP candidate renders under ~100KB. Names the actual biggest
 * contributors rather than just stating the total — a raw byte count with
 * no breakdown gives the author nothing to act on. Measured on whatever
 * network this browser session actually has, not a throttled mobile
 * simulation, so the detail says so briefly rather than implying this
 * number would reproduce on PageSpeed Insights.
 */
export function evaluateLcpPayloadBudget(lcp: number | null, resources: ResourceInfo[], pageOrigin = ''): Finding[] {
  if (lcp == null) return [];
  const beforeLcp = resources.filter((r) => r.responseEnd != null && r.responseEnd > 0 && r.responseEnd <= lcp);
  if (!beforeLcp.length) return [];
  const totalBytes = beforeLcp.reduce((sum, r) => sum + r.transferSize, 0);
  if (totalBytes <= LCP_PAYLOAD_BUDGET) return [];

  const topContributors = [...beforeLcp]
    .sort((a, b) => b.transferSize - a.transferSize)
    .slice(0, TOP_CONTRIBUTORS_SHOWN)
    .map((r) => `${relativizeUrl(r.name, pageOrigin)} (${formatBytes(r.transferSize)})`)
    .join(', ');

  return [
    {
      id: 'perf-lcp-payload-budget',
      title: 'Payload before LCP exceeds the ~100KB budget',
      detail: `Biggest contributors: ${topContributors}. Measured on this session's real network, not a throttled mobile simulation — compare against PageSpeed Insights (Mobile) for a stricter baseline.`,
      severity: totalBytes > LCP_PAYLOAD_BUDGET * 2 ? 'critical' : 'warning',
      measured: formatBytes(totalBytes),
      allowed: formatBytes(LCP_PAYLOAD_BUDGET),
    },
  ];
}

/**
 * Connecting to a new origin (DNS lookup + TLS handshake) before LCP
 * competes with the LCP candidate for the same limited early-bandwidth
 * budget — counter-intuitive guidance a generic performance tool wouldn't
 * surface as a named rule.
 */
export function evaluateEarlyThirdPartyConnections(lcp: number | null, resources: ResourceInfo[], pageOrigin: string): Finding[] {
  if (lcp == null) return [];
  const origins = Array.from(
    new Set(
      resources.filter((r) => r.origin && r.origin !== pageOrigin && r.startTime != null && r.startTime < lcp).map((r) => r.origin as string),
    ),
  );
  if (!origins.length) return [];
  return [
    {
      id: 'perf-early-third-party',
      title: `${origins.length} third-party origin${origins.length > 1 ? 's' : ''} connected before LCP`,
      detail: `Connecting to a new origin costs a DNS lookup and TLS handshake that competes with the LCP candidate for the same limited early bandwidth: ${origins.join(', ')}.`,
      severity: 'warning',
    },
  ];
}

export interface PreloadHint {
  path: string;
  /** Undefined when the preloaded resource has no visible on-page usage to locate. */
  selector?: string;
  reason: 'preload' | 'fetchpriority-high';
}

/**
 * A <link rel="preload"> lives in <head> and is never rendered — it has no
 * box on the page, so a selector built from the <link> itself would make
 * "locate on page" silently no-op (nothing to scroll to or highlight).
 * Point at the real visible element using that same resource instead (the
 * <img> it was preloading for, most commonly), so the button actually goes
 * somewhere; if nothing on the page visibly uses that URL, leave it
 * non-actionable rather than pretending the <link> itself is locatable.
 */
function findVisibleUsage(doc: Document, url: string): string | undefined {
  const img = Array.from(doc.querySelectorAll<HTMLImageElement>('img[src]')).find((el) => el.currentSrc === url || el.src === url);
  return img ? buildSelector(img) : undefined;
}

/**
 * Counter-intuitive aem.live guidance: <link rel="preload"> and
 * fetchpriority="high" both consume the same limited early-bandwidth
 * budget the LCP candidate needs, and tend to hurt LCP in practice despite
 * looking like an optimization — the opposite of typical generic
 * performance advice, which is exactly why a generic tool wouldn't flag
 * this as a problem (it would more likely recommend the opposite).
 */
export function gatherPreloadHints(doc: Document = document): PreloadHint[] {
  const hints: PreloadHint[] = [];
  doc.querySelectorAll<HTMLLinkElement>('link[rel="preload"]').forEach((el) => {
    hints.push({ path: el.href, selector: findVisibleUsage(doc, el.href), reason: 'preload' });
  });
  doc.querySelectorAll<HTMLElement>('[fetchpriority="high"]').forEach((el) => {
    const path = (el as HTMLImageElement).src || (el as HTMLAnchorElement).href || buildSelector(el);
    hints.push({ path, selector: buildSelector(el), reason: 'fetchpriority-high' });
  });
  return hints;
}

export function evaluatePreloadHints(hints: PreloadHint[], pageOrigin = ''): Finding[] {
  return hints.map((h) => ({
    id: `perf-preload-${h.reason}-${h.path}`,
    title: h.reason === 'preload' ? '<link rel="preload"> found' : 'fetchpriority="high" found',
    detail:
      'aem.live\'s "Keeping it 100" guidance is to avoid preload hints and fetchpriority="high" — despite looking like an LCP optimization, both consume the same limited early-bandwidth budget the LCP candidate needs and tend to hurt LCP in practice.',
    severity: 'warning',
    path: relativizeUrl(h.path, pageOrigin),
    targetSelector: h.selector,
  }));
}

/**
 * aem.live/docs/testing treats .aem.page and .aem.live as "preview/delivery
 * tiers," not the production CDN a real visitor hits, and treats field RUM
 * data as the authoritative performance source, not a single-session
 * in-browser reading like the CWV grid above — and that reading is one
 * device (formFactor), not a mobile+desktop pair. Always idle/informational
 * (not a pass/fail check — there's nothing to verify, just scope to
 * disclose), so the detail stays to one short sentence rather than
 * re-explaining the whole testing-methodology doc inline.
 */
export function evaluateMeasurementScope(ref: GithubRefInfo, formFactor: FormFactor): Finding[] {
  if (!ref.matched || !ref.host) return [];
  return [
    {
      id: 'perf-measurement-scope',
      title: `Measured on ${ref.host}, not the production CDN`,
      detail: `One ${formFactor.toLowerCase()} session on ${ref.host}, not production traffic or a mobile+desktop pair — a spot-check, not a lab report.`,
      severity: 'idle',
    },
  ];
}

export function buildRecommendations(params: {
  cwv: Metric[];
  renderBlockers: RenderBlocker[];
  largeBundles: Finding[];
  duplicates: Finding[];
}): string[] {
  const recs: string[] = [];
  const bad = (m?: Metric) => m && (m.severity === 'warning' || m.severity === 'critical');

  if (bad(params.cwv.find((m) => m.id === 'cls'))) {
    recs.push('Set explicit width and height on images so the browser can reserve space before they load, reducing layout shift.');
  }
  if (bad(params.cwv.find((m) => m.id === 'lcp'))) {
    recs.push(
      'Compress or right-size the largest above-the-fold image/text block driving LCP — avoid preload hints or connections to other origins before it renders, which compete for the same limited early bandwidth.',
    );
  }
  if (bad(params.cwv.find((m) => m.id === 'fcp'))) {
    recs.push('Reduce what blocks first paint — inline critical CSS or defer non-essential styles/scripts.');
  }
  if (params.renderBlockers.length) {
    recs.push(`Defer or async ${params.renderBlockers.length} render-blocking resource${params.renderBlockers.length > 1 ? 's' : ''} in <head>.`);
  }
  if (params.largeBundles.length) {
    recs.push(`Split or compress ${params.largeBundles.length} oversized bundle${params.largeBundles.length > 1 ? 's' : ''}.`);
  }
  if (params.duplicates.length) {
    recs.push(`Dedupe ${params.duplicates.length} resource${params.duplicates.length > 1 ? 's' : ''} requested more than once.`);
  }
  return recs;
}
