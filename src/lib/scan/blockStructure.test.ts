import { describe, it, expect } from 'vitest';
import { evaluateBlockStructure, type BlockInfo } from './blockStructure';

function block(overrides: Partial<BlockInfo> = {}): BlockInfo {
  return { name: 'cards', status: 'loaded', selector: '.cards', empty: false, ...overrides };
}

describe('evaluateBlockStructure', () => {
  it('notes (does not error) when no block markers exist on the page yet, but the EDS runtime is present', () => {
    const findings = evaluateBlockStructure([]);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('idle');
  });

  it('warns when no block markers exist AND no EDS runtime (window.hlx / scripts/aem.js) was detected', () => {
    const findings = evaluateBlockStructure([], false);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('warning');
    expect(findings[0].title).toMatch(/runtime/i);
  });

  it('flags a block whose decorate() threw as critical, pointing at the real element', () => {
    const b = block({ name: 'reviews', status: 'error', selector: '.reviews' });
    const findings = evaluateBlockStructure([b]);
    const finding = findings.find((f) => f.id === `blocks-error-${b.selector}`);
    expect(finding?.severity).toBe('critical');
    expect(finding?.targetSelector).toBe('.reviews');
  });

  it('flags a block stuck loading as a warning', () => {
    const findings = evaluateBlockStructure([block({ status: 'loading' })]);
    expect(findings.find((f) => f.id.startsWith('blocks-stuck'))?.severity).toBe('warning');
  });

  it('flags a loaded-but-empty block as a warning', () => {
    const findings = evaluateBlockStructure([block({ status: 'loaded', empty: true })]);
    expect(findings.find((f) => f.id.startsWith('blocks-empty'))?.severity).toBe('warning');
  });

  it('does not flag a healthy, loaded, non-empty block', () => {
    const findings = evaluateBlockStructure([block({ status: 'loaded', empty: false })]);
    expect(findings).toHaveLength(0);
  });

  it('evaluates each block independently in a mixed set', () => {
    const findings = evaluateBlockStructure([
      block({ name: 'cards', status: 'loaded', empty: false, selector: '.cards' }),
      block({ name: 'reviews', status: 'error', selector: '.reviews' }),
    ]);
    expect(findings).toHaveLength(1);
    expect(findings[0].path).toBe('reviews');
  });
});
