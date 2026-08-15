// EDS-native structural check: scripts/aem.js marks every block with
// data-block-status as its loader processes it — "loading" while its
// decorate() runs, "loaded" once it resolves, or left stuck / never set to
// "loaded" if decorate() threw. Generic web-audit tools (Lighthouse, axe,
// SEO checkers) have no concept of an EDS "block" at all, so a silently
// broken or empty section is invisible to them — this is squarely the kind
// of failure Sanity exists to catch that nothing else can.
import type { Finding } from '../../data/types';
import { buildSelector } from '../selector';

export interface BlockInfo {
  name: string;
  status: string | null;
  selector: string;
  empty: boolean;
}

export function gatherBlockStructure(doc: Document = document): BlockInfo[] {
  return Array.from(doc.querySelectorAll<HTMLElement>('[data-block-status]')).map((el) => ({
    name: el.dataset.blockName || el.className.split(' ')[0] || 'block',
    status: el.dataset.blockStatus ?? null,
    selector: buildSelector(el),
    empty: !el.textContent?.trim() && el.children.length === 0,
  }));
}

/** window.hlx is set by scripts/aem.js early in its lifecycle; the script tag itself is the fallback signal. */
export function gatherEdsRuntimeDetected(doc: Document = document, win: Window = window): boolean {
  return Boolean((win as unknown as { hlx?: unknown }).hlx) || Boolean(doc.querySelector('script[src*="/scripts/aem.js"], script[src*="/scripts/scripts.js"]'));
}

export function evaluateBlockStructure(blocks: BlockInfo[], runtimeDetected = true): Finding[] {
  if (blocks.length === 0) {
    return [
      {
        id: 'blocks-none',
        title: runtimeDetected ? 'No EDS block status markers found' : 'EDS runtime (scripts/aem.js) not detected',
        detail: runtimeDetected
          ? 'This check reads data-block-status, set by scripts/aem.js as it loads each block — nothing to check until that pipeline has run on this page.'
          : "Neither window.hlx nor a scripts/aem.js <script> tag was found on this page — the EDS block-loading pipeline may not be running at all, which means block status, RUM, and other runtime behavior aren't active either.",
        severity: runtimeDetected ? 'idle' : 'warning',
      },
    ];
  }

  const findings: Finding[] = [];

  for (const block of blocks) {
    if (block.status === 'error') {
      findings.push({
        id: `blocks-error-${block.selector}`,
        title: `"${block.name}" block failed to load`,
        detail: 'Its decorate() threw before rendering anything — this section is silently blank on the live page.',
        severity: 'critical',
        path: block.name,
        targetSelector: block.selector,
      });
    } else if (block.status === 'loading') {
      findings.push({
        id: `blocks-stuck-${block.selector}`,
        title: `"${block.name}" block never finished loading`,
        detail: 'Still marked "loading" after the page settled — its decorate() may be hung on a failed request.',
        severity: 'warning',
        path: block.name,
        targetSelector: block.selector,
      });
    } else if (block.status === 'loaded' && block.empty) {
      findings.push({
        id: `blocks-empty-${block.selector}`,
        title: `"${block.name}" block loaded with no content`,
        detail: 'Loaded successfully but rendered nothing — likely an empty table when this block was authored.',
        severity: 'warning',
        path: block.name,
        targetSelector: block.selector,
      });
    }
  }

  return findings;
}
