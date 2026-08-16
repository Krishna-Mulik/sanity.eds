// Wraps axe-core, the client-side accessibility engine, run against the
// real document (excluding Sanity's own shadow host, and the real Sidekick
// chrome itself, so the panel never flags tooling that isn't part of the
// page being audited).
import axe from 'axe-core';
import type { Finding } from '../../data/types';
import type { HeadingInfo } from './seo';
import type { Severity } from '../severity';
import { buildSelector } from '../selector';

const IMPACT_SEVERITY: Record<string, Severity> = {
  critical: 'critical',
  serious: 'critical',
  moderate: 'warning',
  minor: 'normal',
};

export async function gatherAccessibility(): Promise<axe.Result[]> {
  const results = await axe.run({ exclude: ['#sanity-panel-host', 'aem-sidekick'] }, { resultTypes: ['violations'] });
  return results.violations;
}

function primarySelector(target: unknown): string | undefined {
  return Array.isArray(target) && typeof target[0] === 'string' ? target[0] : undefined;
}

export function evaluateAccessibility(violations: axe.Result[]): Finding[] {
  return violations.flatMap((violation) =>
    violation.nodes.map((node, i) => ({
      id: `a11y-${violation.id}-${i}-${JSON.stringify(node.target)}`,
      title: violation.help,
      detail: violation.description,
      severity: IMPACT_SEVERITY[violation.impact ?? 'moderate'] ?? 'warning',
      path: node.target.map(String).join(', '),
      targetSelector: primarySelector(node.target),
    })),
  );
}

// axe-core's page-has-heading-one and heading-order rules already cover a
// missing H1 and skipped levels — this covers the one gap axe leaves:
// multiple H1s isn't itself a WCAG violation (HTML5 sectioning allows it),
// but it still muddies the page's single topic for both screen readers and
// search engines, so it's worth keeping as our own check. Treated as
// critical (not a soft warning) — an EDS page has exactly one authored H1
// by convention, so a second one is a real authoring mistake, not a matter
// of taste.
export function evaluateHeadingStructure(headings: HeadingInfo[]): Finding[] {
  const h1s = headings.filter((h) => h.level === 1);
  if (h1s.length <= 1) return [];
  return [
    {
      id: 'a11y-h1-multiple',
      title: `${h1s.length} H1 headings`,
      detail: 'A page should have exactly one H1 so its topic is unambiguous to screen readers and search engines.',
      severity: 'critical',
      path: `${h1s.length}× h1`,
      targetSelector: h1s[1].selector,
    },
  ];
}

export interface ImageAltInfo {
  hasAlt: boolean;
  alt: string | null;
  width: number;
  height: number;
  selector: string;
}

// Below this, an empty alt is routinely a decorative spacer/icon — not
// worth a finding. Above it, an empty alt on a real content-sized image is
// exactly the case axe-core can't see: EDS's createOptimizedPicture() sets
// alt="" whenever the author never typed alt text in the source doc, and an
// empty alt is syntactically valid (it means "decorative" to a screen
// reader) so axe's image-alt rule — which only flags a *missing* alt
// attribute — passes it clean even when the image is real content.
const CONTENT_IMAGE_SIZE_PX = 32;

export function gatherImageAltInfo(doc: Document = document): ImageAltInfo[] {
  return Array.from(doc.querySelectorAll('img'))
    .filter((img) => !img.closest('#sanity-panel-host') && !img.closest('aem-sidekick'))
    .map((img) => ({
      hasAlt: img.hasAttribute('alt'),
      alt: img.getAttribute('alt'),
      // Rendered box size, not intrinsic file resolution — an SVG's
      // naturalWidth can report its internal viewBox size (often much
      // larger than how it's actually displayed), which previously
      // false-flagged small CSS-sized icons as content images.
      width: img.width || img.naturalWidth,
      height: img.height || img.naturalHeight,
      selector: buildSelector(img),
    }));
}

export function evaluateEmptyAltImages(images: ImageAltInfo[]): Finding[] {
  return images
    .filter((img) => img.hasAlt && img.alt === '' && img.width > CONTENT_IMAGE_SIZE_PX && img.height > CONTENT_IMAGE_SIZE_PX)
    .map((img) => ({
      id: `a11y-empty-alt-${img.selector}`,
      title: 'Image has an empty alt attribute',
      detail:
        'An empty alt="" marks this image as decorative to screen readers. EDS sets this automatically when no alt text was authored in the source document — if this image conveys real content, add descriptive alt text there.',
      severity: 'warning',
      path: img.selector,
      targetSelector: img.selector,
    }));
}
