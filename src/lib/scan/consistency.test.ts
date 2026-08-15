import { describe, it, expect } from 'vitest';
import { evaluateConsistency, type ConsistencyRawData } from './consistency';

function base(overrides: Partial<ConsistencyRawData> = {}): ConsistencyRawData {
  return {
    status: 'ok',
    currentHost: 'aem.page',
    counterpartHost: 'aem.live',
    counterpartUrl: 'https://main--site--owner.aem.live/page',
    counterpartStatus: 200,
    currentTitle: 'Trail packs',
    counterpartTitle: 'Trail packs',
    currentDescription: 'Weatherproof packs.',
    counterpartDescription: 'Weatherproof packs.',
    currentBlocks: ['Since 2014 we build packs.', 'Free shipping over $50.'],
    counterpartBlocks: ['Since 2014 we build packs.', 'Free shipping over $50.'],
    ...overrides,
  };
}

describe('evaluateConsistency — not applicable', () => {
  it('notes when the host is not a recognized preview/live pattern', () => {
    const findings = evaluateConsistency(base({ status: 'not-applicable', currentHost: null, counterpartHost: null }));
    expect(findings).toHaveLength(1);
    expect(findings[0].id).toBe('consistency-not-applicable');
    expect(findings[0].severity).toBe('idle');
  });
});

describe('evaluateConsistency — fetch blocked', () => {
  it('notes (not warns) when the cross-origin fetch fails or is CORS-blocked', () => {
    const findings = evaluateConsistency(base({ status: 'fetch-blocked', counterpartTitle: null, currentBlocks: [], counterpartBlocks: [] }));
    expect(findings).toHaveLength(1);
    expect(findings[0].id).toBe('consistency-fetch-blocked');
    expect(findings[0].severity).toBe('idle');
  });
});

describe('evaluateConsistency — counterpart missing', () => {
  it('notes (not warns) when preview content is not yet published to live', () => {
    const findings = evaluateConsistency(
      base({ status: 'counterpart-missing', currentHost: 'aem.page', counterpartHost: 'aem.live', counterpartStatus: 404 }),
    );
    expect(findings[0].severity).toBe('idle');
  });

  it('warns when a live page no longer exists in preview', () => {
    const findings = evaluateConsistency(
      base({ status: 'counterpart-missing', currentHost: 'aem.live', counterpartHost: 'aem.page', counterpartStatus: 404 }),
    );
    expect(findings[0].severity).toBe('warning');
  });
});

describe('evaluateConsistency — ok, content matches', () => {
  it('produces no findings when title, description, and body content all match', () => {
    expect(evaluateConsistency(base())).toHaveLength(0);
  });
});

describe('evaluateConsistency — ok, content differs', () => {
  it('flags a differing title as idle, not a failure', () => {
    const findings = evaluateConsistency(base({ counterpartTitle: 'Trail packs — Sale' }));
    const finding = findings.find((f) => f.id === 'consistency-title-diff');
    expect(finding?.severity).toBe('idle');
    expect(finding?.detail).toMatch(/Trail packs — Sale/);
  });

  it('flags a differing description as idle', () => {
    const findings = evaluateConsistency(base({ counterpartDescription: 'New season packs.' }));
    expect(findings.find((f) => f.id === 'consistency-description-diff')?.severity).toBe('idle');
  });

  it('reports text present only on the current host', () => {
    const findings = evaluateConsistency(base({ currentBlocks: ['Since 2014 we build packs.', 'Free shipping over $50.', 'New: lifetime warranty.'] }));
    const finding = findings.find((f) => f.title === 'Only on aem.page');
    expect(finding).toBeTruthy();
    expect(finding?.path).toBe('New: lifetime warranty.');
  });

  it('reports text present only on the counterpart host', () => {
    const findings = evaluateConsistency(base({ counterpartBlocks: ['Since 2014 we build packs.', 'Free shipping over $50.', 'Now 20% off.'] }));
    const finding = findings.find((f) => f.title === 'Only on aem.live');
    expect(finding).toBeTruthy();
    expect(finding?.path).toBe('Now 20% off.');
  });

  it('caps shown diff lines and notes how many more exist', () => {
    const currentBlocks = Array.from({ length: 8 }, (_, i) => `current-only line ${i}`);
    const findings = evaluateConsistency(base({ currentBlocks, counterpartBlocks: [] }));
    const onlyCurrentFindings = findings.filter((f) => f.title === 'Only on aem.page');
    expect(onlyCurrentFindings).toHaveLength(5);
    expect(findings.find((f) => f.id === 'consistency-diff-truncated')).toBeTruthy();
  });

  it('does not flag identical content even if block order differs', () => {
    const findings = evaluateConsistency(base({ counterpartBlocks: ['Free shipping over $50.', 'Since 2014 we build packs.'] }));
    expect(findings.some((f) => f.title.startsWith('Only on'))).toBe(false);
  });
});
