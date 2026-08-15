// Link analysis: total/unique/internal/external counts and broken-link
// detection. Same-origin links get an accurate status code via a normal
// fetch; cross-origin links can only be probed with a no-cors HEAD, which
// can catch a hard network failure but never see the real status code (a
// browser CORS restriction, not a shortcut) — those are never reported as
// "broken", only as unchecked.
//
// Accessible-name checking (a link with no visible text/title/aria-label)
// is deliberately NOT done here — axe-core's link-name rule (Accessibility
// section) already covers it, more rigorously than a hand-rolled check
// (it also accounts for aria-labelledby, image alt inside the link, etc.).
import type { Finding, LinkStats } from '../../data/types';
import { buildSelector } from '../selector';

export interface LinkInfo {
  href: string;
  url: URL | null;
  checkable: boolean;
  internal: boolean;
  hasTitle: boolean;
  text: string;
  selector: string;
}

export function gatherLinks(doc: Document = document, win: Window = window): LinkInfo[] {
  const origin = win.location.origin;
  return Array.from(doc.querySelectorAll('a[href]')).map((el) => {
    const href = el.getAttribute('href') || '';
    let url: URL | null = null;
    try {
      url = new URL(href, doc.baseURI);
    } catch {
      url = null;
    }
    return {
      href,
      url,
      checkable: Boolean(url && /^https?:$/.test(url.protocol)),
      internal: Boolean(url && url.origin === origin),
      hasTitle: el.hasAttribute('title'),
      text: (el.textContent || '').trim(),
      selector: buildSelector(el),
    };
  });
}

const CHECK_TIMEOUT_MS = 4000;
const MAX_CHECKED = 40;
const CONCURRENCY = 6;

export interface LinkCheckResult {
  broken: boolean;
  status?: number;
  reason: 'ok' | 'http-error' | 'network-error' | 'timeout' | 'cross-origin-unknown';
}

async function checkOne(link: LinkInfo): Promise<LinkCheckResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
  try {
    if (link.internal) {
      const res = await fetch(link.url!.href, { method: 'HEAD', signal: controller.signal });
      return { broken: !res.ok, status: res.status, reason: res.ok ? 'ok' : 'http-error' };
    }
    await fetch(link.url!.href, { method: 'HEAD', mode: 'no-cors', signal: controller.signal });
    return { broken: false, reason: 'cross-origin-unknown' };
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'AbortError';
    return { broken: true, reason: timedOut ? 'timeout' : 'network-error' };
  } finally {
    clearTimeout(timer);
  }
}

export async function checkLinks(links: LinkInfo[]): Promise<Map<string, LinkCheckResult>> {
  const checkable = links.filter((l) => l.checkable && l.url);
  const uniqueByHref = new Map<string, LinkInfo>();
  for (const link of checkable) uniqueByHref.set(link.url!.href, link);
  const unique = Array.from(uniqueByHref.values()).slice(0, MAX_CHECKED);

  const results = new Map<string, LinkCheckResult>();
  let index = 0;
  async function worker() {
    while (index < unique.length) {
      const link = unique[index++];
      results.set(link.url!.href, await checkOne(link));
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, unique.length) }, worker));
  return results;
}

export function evaluateLinks(
  links: LinkInfo[],
  checks: Map<string, LinkCheckResult>,
): { stats: LinkStats; findings: Finding[] } {
  const findings: Finding[] = [];

  const uniqueHrefs = new Set(links.map((l) => l.url?.href ?? l.href));
  let brokenCount = 0;

  for (const [href, result] of checks) {
    if (!result.broken) continue;
    brokenCount++;
    const link = links.find((l) => l.url?.href === href);
    const detail =
      result.reason === 'timeout'
        ? `The link did not respond within ${CHECK_TIMEOUT_MS / 1000} seconds.`
        : result.reason === 'http-error'
          ? `Server responded with status ${result.status}.`
          : 'The request failed — check the URL is correct and the target is reachable.';
    // Same-origin links don't need this site's own domain repeated in
    // front of them; a cross-origin broken link keeps its full URL since
    // the domain is exactly what tells you which external site is down.
    const displayPath = link?.internal && link.url ? link.url.pathname + link.url.search + link.url.hash : href;
    findings.push({
      id: `links-broken-${href}`,
      title: result.status ? `Broken link (${result.status})` : 'Broken link',
      detail,
      severity: 'critical',
      path: displayPath,
      targetSelector: link?.selector,
    });
  }

  const stats: LinkStats = {
    total: links.length,
    unique: uniqueHrefs.size,
    internal: links.filter((l) => l.internal).length,
    external: links.filter((l) => l.url && !l.internal).length,
    missingTitle: links.filter((l) => !l.hasTitle).length,
    broken: brokenCount,
    checked: checks.size,
  };

  return { stats, findings };
}
