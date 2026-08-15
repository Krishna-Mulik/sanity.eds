// Wraps axe-core, the client-side accessibility engine, run against the
// real document (excluding Sanity's own shadow host so the panel never
// flags itself).
import axe from 'axe-core';
import type { Finding } from '../../data/types';
import type { HeadingInfo } from './seo';
import type { Severity } from '../severity';

const IMPACT_SEVERITY: Record<string, Severity> = {
  critical: 'critical',
  serious: 'critical',
  moderate: 'warning',
  minor: 'normal',
};

export async function gatherAccessibility(): Promise<axe.Result[]> {
  const results = await axe.run({ exclude: ['#sanity-panel-host'] }, { resultTypes: ['violations'] });
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
// search engines, so it's worth keeping as our own check.
export function evaluateHeadingStructure(headings: HeadingInfo[]): Finding[] {
  const h1s = headings.filter((h) => h.level === 1);
  if (h1s.length <= 1) return [];
  return [
    {
      id: 'a11y-h1-multiple',
      title: `${h1s.length} H1 headings`,
      detail: 'A page should have exactly one H1 so its topic is unambiguous to screen readers and search engines.',
      severity: 'warning',
      path: `${h1s.length}× h1`,
      targetSelector: h1s[1].selector,
    },
  ];
}
