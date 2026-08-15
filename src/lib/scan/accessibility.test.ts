import { describe, it, expect } from 'vitest';
import type axe from 'axe-core';
import { evaluateAccessibility, evaluateHeadingStructure } from './accessibility';
import type { HeadingInfo } from './seo';

function violation(overrides: Partial<axe.Result>): axe.Result {
  return {
    id: 'image-alt',
    help: 'Images must have alternate text',
    description: 'Ensures <img> elements have alternate text',
    impact: 'critical',
    nodes: [{ target: ['img.hero'] } as axe.NodeResult],
    ...overrides,
  } as axe.Result;
}

describe('evaluateAccessibility', () => {
  it('maps critical and serious impact to critical severity', () => {
    const findings = evaluateAccessibility([violation({ impact: 'critical' }), violation({ impact: 'serious', id: 'other' })]);
    expect(findings.every((f) => f.severity === 'critical')).toBe(true);
  });

  it('maps moderate to warning and minor to normal', () => {
    const [moderate] = evaluateAccessibility([violation({ impact: 'moderate' })]);
    expect(moderate.severity).toBe('warning');
    const [minor] = evaluateAccessibility([violation({ impact: 'minor' })]);
    expect(minor.severity).toBe('normal');
  });

  it('produces one finding per affected node, using the node target as the selector', () => {
    const findings = evaluateAccessibility([
      violation({ nodes: [{ target: ['img.a'] } as axe.NodeResult, { target: ['img.b'] } as axe.NodeResult] }),
    ]);
    expect(findings).toHaveLength(2);
    expect(findings[0].targetSelector).toBe('img.a');
    expect(findings[1].targetSelector).toBe('img.b');
  });

  it('uses the violation help text as the finding title', () => {
    const [finding] = evaluateAccessibility([violation({ help: 'Buttons must have discernible text' })]);
    expect(finding.title).toBe('Buttons must have discernible text');
  });
});

describe('evaluateHeadingStructure', () => {
  it('flags multiple H1s — the one gap axe-core\'s heading-order/page-has-heading-one rules leave', () => {
    const headings: HeadingInfo[] = [
      { level: 1, text: 'a', selector: 'h1:nth-of-type(1)' },
      { level: 1, text: 'b', selector: 'h1:nth-of-type(2)' },
    ];
    const findings = evaluateHeadingStructure(headings);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('warning');
    expect(findings[0].targetSelector).toBe('h1:nth-of-type(2)');
  });

  it('does not flag a single H1', () => {
    const headings: HeadingInfo[] = [{ level: 1, text: 'a', selector: 'h1' }];
    expect(evaluateHeadingStructure(headings)).toHaveLength(0);
  });

  it('does not flag zero H1s — that is axe-core\'s page-has-heading-one, not ours to duplicate', () => {
    const headings: HeadingInfo[] = [{ level: 2, text: 'a', selector: 'h2' }];
    expect(evaluateHeadingStructure(headings)).toHaveLength(0);
  });
});
