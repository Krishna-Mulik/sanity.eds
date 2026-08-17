// Preview vs Live: derives this page's counterpart URL on the other EDS
// environment (.aem.page <-> .aem.live, or the legacy .hlx.page <-> .hlx.live)
// from the ref--repo--owner host info siteLimits.ts already parses — no
// fetch involved. An earlier version of this feature fetched the
// counterpart page directly and diffed its content, but that requires
// reading a cross-origin response, and .aem.page/.aem.live send no
// Access-Control-Allow-Origin header by default, so that fetch fails for
// essentially every real site (confirmed against a real deployed site, not
// just reasoned about — see CLAUDE.md). This version sidesteps the problem
// entirely instead of working around it: it hands the author both URLs to
// copy, and a link to a real third-party comparison tool that does its own
// fetching server-side, where CORS doesn't apply.
import type { ConsistencyUrls } from '../../data/types';
import type { GithubRefInfo, PreviewHost } from './siteLimits';

const COUNTERPART: Record<PreviewHost, PreviewHost> = {
  'aem.page': 'aem.live',
  'aem.live': 'aem.page',
  'hlx.page': 'hlx.live',
  'hlx.live': 'hlx.page',
};

export function computeConsistencyUrls(ref: GithubRefInfo, win: Window = window): ConsistencyUrls | null {
  if (!ref.matched || !ref.host) return null;

  const currentHost = ref.host;
  const counterpartHost = COUNTERPART[currentHost];
  const counterpartHostname = `${win.location.hostname.slice(0, -(currentHost.length + 1))}.${counterpartHost}`;
  const counterpartUrl = `${win.location.protocol}//${counterpartHostname}${win.location.pathname}${win.location.search}`;

  return {
    currentUrl: win.location.href,
    currentHost,
    counterpartUrl,
    counterpartHost,
  };
}
