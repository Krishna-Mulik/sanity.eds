// Preview vs live content consistency: compares this page against its
// counterpart on the other EDS environment (.aem.page <-> .aem.live, or
// the legacy .hlx.page <-> .hlx.live) by fetching the same path there and
// diffing title/description/visible text blocks.
//
// .aem.page and .aem.live are different origins from a browser's
// perspective even though they share the same ref--repo--owner, so a
// cross-origin fetch here is attempted, not assumed to work — if the
// target doesn't grant a CORS-permissive response, that's reported as an
// honest "couldn't check" note, same pattern as every other cross-origin
// limitation in this codebase (og:image, JSON sheets, canonical, manifest).
//
// A content mismatch is reported as informational (`idle`), not a
// failure: differing content is the normal state for a page that's been
// edited in preview but not yet published, same reasoning as the
// canonical-URL-mismatch check in seo.ts.
import type { Finding } from '../../data/types';
import type { GithubRefInfo, PreviewHost } from './siteLimits';

const COUNTERPART: Record<PreviewHost, PreviewHost> = {
  'aem.page': 'aem.live',
  'aem.live': 'aem.page',
  'hlx.page': 'hlx.live',
  'hlx.live': 'hlx.page',
};

const BLOCK_SELECTOR = 'p, li, h1, h2, h3, h4, h5, h6, blockquote, td, dt, dd, figcaption';

function extractTextBlocks(doc: Document): string[] {
  const body = doc.body;
  if (!body) return [];
  return Array.from(body.querySelectorAll(BLOCK_SELECTOR))
    .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
    .filter((text) => text.length > 0);
}

export type ConsistencyStatus = 'not-applicable' | 'ok' | 'counterpart-missing' | 'fetch-blocked';

export interface ConsistencyRawData {
  status: ConsistencyStatus;
  currentHost: PreviewHost | null;
  counterpartHost: PreviewHost | null;
  counterpartUrl: string | null;
  counterpartStatus: number | null;
  currentTitle: string | null;
  counterpartTitle: string | null;
  currentDescription: string | null;
  counterpartDescription: string | null;
  currentBlocks: string[];
  counterpartBlocks: string[];
}

const FETCH_TIMEOUT_MS = 6000;
const NOT_APPLICABLE: ConsistencyRawData = {
  status: 'not-applicable',
  currentHost: null,
  counterpartHost: null,
  counterpartUrl: null,
  counterpartStatus: null,
  currentTitle: null,
  counterpartTitle: null,
  currentDescription: null,
  counterpartDescription: null,
  currentBlocks: [],
  counterpartBlocks: [],
};

export async function gatherConsistency(ref: GithubRefInfo, doc: Document = document, win: Window = window): Promise<ConsistencyRawData> {
  if (!ref.matched || !ref.host) return NOT_APPLICABLE;

  const currentHost = ref.host;
  const counterpartHost = COUNTERPART[currentHost];
  const counterpartHostname = `${win.location.hostname.slice(0, -(currentHost.length + 1))}.${counterpartHost}`;
  const counterpartUrl = `${win.location.protocol}//${counterpartHostname}${win.location.pathname}${win.location.search}`;

  const currentTitle = doc.querySelector('title')?.textContent?.trim() || null;
  const currentDescription = doc.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || null;
  const currentBlocks = extractTextBlocks(doc);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(counterpartUrl, { signal: controller.signal, cache: 'no-store' });
    if (!res.ok) {
      return {
        ...NOT_APPLICABLE,
        status: 'counterpart-missing',
        currentHost,
        counterpartHost,
        counterpartUrl,
        counterpartStatus: res.status,
        currentTitle,
        currentDescription,
        currentBlocks,
      };
    }
    const html = await res.text();
    const counterpartDoc = new DOMParser().parseFromString(html, 'text/html');
    return {
      status: 'ok',
      currentHost,
      counterpartHost,
      counterpartUrl,
      counterpartStatus: res.status,
      currentTitle,
      counterpartTitle: counterpartDoc.querySelector('title')?.textContent?.trim() || null,
      currentDescription,
      counterpartDescription: counterpartDoc.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || null,
      currentBlocks,
      counterpartBlocks: extractTextBlocks(counterpartDoc),
    };
  } catch {
    return {
      ...NOT_APPLICABLE,
      status: 'fetch-blocked',
      currentHost,
      counterpartHost,
      counterpartUrl,
      currentTitle,
      currentDescription,
      currentBlocks,
    };
  } finally {
    clearTimeout(timer);
  }
}

const MAX_DIFF_LINES = 5;

export function evaluateConsistency(raw: ConsistencyRawData): Finding[] {
  if (raw.status === 'not-applicable') {
    return [
      {
        id: 'consistency-not-applicable',
        title: 'Preview/live comparison not applicable',
        detail: "This page isn't on a recognized aem.page/aem.live (or hlx.page/hlx.live) host, so there's no counterpart environment to compare against.",
        severity: 'idle',
      },
    ];
  }

  if (raw.status === 'fetch-blocked') {
    return [
      {
        id: 'consistency-fetch-blocked',
        title: `Could not compare against ${raw.counterpartHost}`,
        detail: `The request to ${raw.counterpartUrl} failed outright, or that host doesn't grant a CORS-permissive response to a cross-origin request from ${raw.currentHost} — this comparison only works when it does.`,
        severity: 'idle',
        path: raw.counterpartUrl ?? undefined,
      },
    ];
  }

  if (raw.status === 'counterpart-missing') {
    // Preview content not yet published to live is the normal, expected
    // case; a live page that's vanished from preview is more unusual.
    const isPreviewToLive = raw.currentHost === 'aem.page' || raw.currentHost === 'hlx.page';
    return [
      {
        id: 'consistency-counterpart-missing',
        title: `This page doesn't exist on ${raw.counterpartHost} (HTTP ${raw.counterpartStatus})`,
        detail: isPreviewToLive
          ? "Not necessarily a problem — normal for content that's been previewed but not yet published."
          : "This page is live but no longer present in preview — worth confirming that's intentional.",
        severity: isPreviewToLive ? 'idle' : 'warning',
        path: raw.counterpartUrl ?? undefined,
      },
    ];
  }

  // status === 'ok'
  const findings: Finding[] = [];

  if (raw.currentTitle !== raw.counterpartTitle) {
    findings.push({
      id: 'consistency-title-diff',
      title: `Title differs between ${raw.currentHost} and ${raw.counterpartHost}`,
      detail: `${raw.currentHost}: "${raw.currentTitle ?? '(missing)'}" — ${raw.counterpartHost}: "${raw.counterpartTitle ?? '(missing)'}". May be intentional if content is still being edited.`,
      severity: 'idle',
    });
  }

  if (raw.currentDescription !== raw.counterpartDescription) {
    findings.push({
      id: 'consistency-description-diff',
      title: `Meta description differs between ${raw.currentHost} and ${raw.counterpartHost}`,
      detail: `${raw.currentHost}: "${raw.currentDescription ?? '(missing)'}" — ${raw.counterpartHost}: "${raw.counterpartDescription ?? '(missing)'}". May be intentional if content is still being edited.`,
      severity: 'idle',
    });
  }

  const currentSet = new Set(raw.currentBlocks);
  const counterpartSet = new Set(raw.counterpartBlocks);
  const onlyCurrent = raw.currentBlocks.filter((b) => !counterpartSet.has(b));
  const onlyCounterpart = raw.counterpartBlocks.filter((b) => !currentSet.has(b));

  const clip = (line: string) => (line.length > 140 ? `${line.slice(0, 140)}…` : line);

  for (const line of onlyCurrent.slice(0, MAX_DIFF_LINES)) {
    findings.push({
      id: `consistency-only-${raw.currentHost}-${line.slice(0, 40)}`,
      title: `Only on ${raw.currentHost}`,
      detail: `This text is present on ${raw.currentHost} but not found on ${raw.counterpartHost}.`,
      severity: 'idle',
      path: clip(line),
    });
  }

  for (const line of onlyCounterpart.slice(0, MAX_DIFF_LINES)) {
    findings.push({
      id: `consistency-only-${raw.counterpartHost}-${line.slice(0, 40)}`,
      title: `Only on ${raw.counterpartHost}`,
      detail: `This text is present on ${raw.counterpartHost} but not found on ${raw.currentHost}.`,
      severity: 'idle',
      path: clip(line),
    });
  }

  if (onlyCurrent.length > MAX_DIFF_LINES || onlyCounterpart.length > MAX_DIFF_LINES) {
    findings.push({
      id: 'consistency-diff-truncated',
      title: 'More content differences than shown',
      detail: `Showing the first ${MAX_DIFF_LINES} differing blocks per side — ${onlyCurrent.length} only on ${raw.currentHost}, ${onlyCounterpart.length} only on ${raw.counterpartHost} in total.`,
      severity: 'idle',
    });
  }

  return findings;
}
