import { describe, it, expect } from 'vitest';
import {
  evaluateCwv,
  computeScore,
  evaluateRenderBlocking,
  evaluateLargeBundles,
  evaluateDuplicateRequests,
  evaluateLcpPayloadBudget,
  evaluateEarlyThirdPartyConnections,
  evaluatePreloadHints,
  evaluateMeasurementScope,
  buildRecommendations,
  type RawCwv,
  type ResourceInfo,
  type RenderBlockerCandidate,
  type PreloadHint,
} from './performance';

describe('evaluateCwv', () => {
  it('rates a fast LCP as normal and a slow one as critical', () => {
    const fast = evaluateCwv({ lcp: 1200, cls: 0, inp: 50, fcp: 800 });
    expect(fast.find((m) => m.id === 'lcp')?.severity).toBe('normal');

    const slow = evaluateCwv({ lcp: 5000, cls: 0, inp: 50, fcp: 800 });
    expect(slow.find((m) => m.id === 'lcp')?.severity).toBe('critical');
  });

  it('marks an unmeasured metric as idle ("not checked"), not a false pass', () => {
    const raw: RawCwv = { lcp: null, cls: null, inp: null, fcp: null };
    const metrics = evaluateCwv(raw);
    expect(metrics.every((m) => m.severity === 'idle')).toBe(true);
  });

  it('formats sub-second values in ms and second-plus values in s', () => {
    const metrics = evaluateCwv({ lcp: 3800, cls: 0.1, inp: 180, fcp: 900 });
    expect(metrics.find((m) => m.id === 'lcp')?.value).toBe('3.8s');
    expect(metrics.find((m) => m.id === 'fcp')?.value).toBe('900ms');
  });
});

describe('computeScore', () => {
  it('scores 100 when every metric is normal', () => {
    const metrics = evaluateCwv({ lcp: 1000, cls: 0.01, inp: 50, fcp: 500 });
    expect(computeScore(metrics)).toBe(100);
  });

  it('ignores idle (unmeasured) metrics rather than penalizing them', () => {
    const metrics = evaluateCwv({ lcp: 1000, cls: 0.01, inp: null, fcp: 500 });
    expect(computeScore(metrics)).toBe(100);
  });
});

describe('evaluateRenderBlocking', () => {
  it('matches a candidate to its resource-timing duration and grades severity by blocking time', () => {
    const candidates: RenderBlockerCandidate[] = [{ path: '/scripts/vendor.js', selector: 'script', tag: 'script' }];
    const resources: ResourceInfo[] = [{ name: '/scripts/vendor.js', initiatorType: 'script', transferSize: 1000, duration: 340 }];
    const blockers = evaluateRenderBlocking(candidates, resources);
    expect(blockers[0].blockingMs).toBe(340);
    expect(blockers[0].severity).toBe('critical');
  });
});

describe('evaluateLargeBundles', () => {
  it('flags a script over the 150KB threshold', () => {
    const resources: ResourceInfo[] = [{ name: '/bundle.js', initiatorType: 'script', transferSize: 200 * 1024, duration: 10 }];
    expect(evaluateLargeBundles(resources)).toHaveLength(1);
  });

  it('does not flag a small script', () => {
    const resources: ResourceInfo[] = [{ name: '/small.js', initiatorType: 'script', transferSize: 10 * 1024, duration: 10 }];
    expect(evaluateLargeBundles(resources)).toHaveLength(0);
  });

  it('shows a same-origin bundle without repeating this site\'s own domain', () => {
    const resources: ResourceInfo[] = [{ name: 'https://example.com/bundle.js', initiatorType: 'script', transferSize: 200 * 1024, duration: 10 }];
    expect(evaluateLargeBundles(resources, 'https://example.com')[0].path).toBe('/bundle.js');
  });

  it('shows a cross-origin bundle with its full domain', () => {
    const resources: ResourceInfo[] = [{ name: 'https://cdn.example.com/bundle.js', initiatorType: 'script', transferSize: 200 * 1024, duration: 10 }];
    expect(evaluateLargeBundles(resources, 'https://example.com')[0].path).toBe('https://cdn.example.com/bundle.js');
  });
});

describe('evaluateDuplicateRequests', () => {
  it('flags a URL requested more than once', () => {
    const resources: ResourceInfo[] = [
      { name: '/a.js', initiatorType: 'script', transferSize: 10, duration: 1 },
      { name: '/a.js', initiatorType: 'script', transferSize: 10, duration: 1 },
    ];
    expect(evaluateDuplicateRequests(resources)).toHaveLength(1);
  });

  it('does not flag single requests', () => {
    const resources: ResourceInfo[] = [{ name: '/a.js', initiatorType: 'script', transferSize: 10, duration: 1 }];
    expect(evaluateDuplicateRequests(resources)).toHaveLength(0);
  });
});

describe('buildRecommendations', () => {
  it('is empty when nothing is wrong', () => {
    const cwv = evaluateCwv({ lcp: 1000, cls: 0.01, inp: 50, fcp: 500 });
    expect(buildRecommendations({ cwv, renderBlockers: [], largeBundles: [], duplicates: [] })).toHaveLength(0);
  });

  it('recommends fixing layout shift only when CLS is actually bad', () => {
    const cwv = evaluateCwv({ lcp: 1000, cls: 0.4, inp: 50, fcp: 500 });
    const recs = buildRecommendations({ cwv, renderBlockers: [], largeBundles: [], duplicates: [] });
    expect(recs.some((r) => /layout shift/.test(r))).toBe(true);
  });

  it('never tells users to preload the LCP candidate — aem.live guidance says preload hurts LCP', () => {
    const cwv = evaluateCwv({ lcp: 5000, cls: 0.01, inp: 50, fcp: 500 });
    const recs = buildRecommendations({ cwv, renderBlockers: [], largeBundles: [], duplicates: [] });
    const lcpRec = recs.find((r) => /LCP/.test(r));
    expect(lcpRec).toBeTruthy();
    expect(lcpRec).not.toMatch(/^Preload/i);
  });
});

describe('evaluateLcpPayloadBudget', () => {
  it('flags payload before LCP over the ~100KB budget', () => {
    const resources: ResourceInfo[] = [
      { name: '/a.js', initiatorType: 'script', transferSize: 80 * 1024, duration: 10, responseEnd: 500 },
      { name: '/b.css', initiatorType: 'link', transferSize: 40 * 1024, duration: 10, responseEnd: 800 },
    ];
    const findings = evaluateLcpPayloadBudget(1200, resources);
    expect(findings.find((f) => f.id === 'perf-lcp-payload-budget')?.severity).toBe('warning');
  });

  it('does not flag payload under the budget', () => {
    const resources: ResourceInfo[] = [{ name: '/a.js', initiatorType: 'script', transferSize: 20 * 1024, duration: 10, responseEnd: 500 }];
    expect(evaluateLcpPayloadBudget(1200, resources)).toHaveLength(0);
  });

  it('ignores resources that finished after LCP', () => {
    const resources: ResourceInfo[] = [{ name: '/late.js', initiatorType: 'script', transferSize: 500 * 1024, duration: 10, responseEnd: 5000 }];
    expect(evaluateLcpPayloadBudget(1200, resources)).toHaveLength(0);
  });

  it('produces no finding when LCP was never measured', () => {
    const resources: ResourceInfo[] = [{ name: '/a.js', initiatorType: 'script', transferSize: 500 * 1024, duration: 10, responseEnd: 500 }];
    expect(evaluateLcpPayloadBudget(null, resources)).toHaveLength(0);
  });
});

describe('evaluateEarlyThirdPartyConnections', () => {
  it('warns when a third-party origin is contacted before LCP', () => {
    const resources: ResourceInfo[] = [{ name: 'https://cdn.example.com/widget.js', initiatorType: 'script', transferSize: 100, duration: 10, startTime: 200, origin: 'https://cdn.example.com' }];
    const findings = evaluateEarlyThirdPartyConnections(1200, resources, 'https://example.com');
    expect(findings.find((f) => f.id === 'perf-early-third-party')?.severity).toBe('warning');
  });

  it('does not flag a third-party connection that starts after LCP', () => {
    const resources: ResourceInfo[] = [{ name: 'https://cdn.example.com/widget.js', initiatorType: 'script', transferSize: 100, duration: 10, startTime: 3000, origin: 'https://cdn.example.com' }];
    expect(evaluateEarlyThirdPartyConnections(1200, resources, 'https://example.com')).toHaveLength(0);
  });

  it('does not flag same-origin resources', () => {
    const resources: ResourceInfo[] = [{ name: 'https://example.com/a.js', initiatorType: 'script', transferSize: 100, duration: 10, startTime: 200, origin: 'https://example.com' }];
    expect(evaluateEarlyThirdPartyConnections(1200, resources, 'https://example.com')).toHaveLength(0);
  });
});

describe('evaluatePreloadHints', () => {
  it('flags a <link rel="preload"> as a warning', () => {
    const hints: PreloadHint[] = [{ path: '/hero.jpg', selector: 'link', reason: 'preload' }];
    const findings = evaluatePreloadHints(hints);
    expect(findings[0].severity).toBe('warning');
    expect(findings[0].title).toMatch(/preload/i);
  });

  it('flags fetchpriority="high" distinctly from preload', () => {
    const hints: PreloadHint[] = [{ path: '/hero.jpg', selector: 'img', reason: 'fetchpriority-high' }];
    const findings = evaluatePreloadHints(hints);
    expect(findings[0].title).toMatch(/fetchpriority/i);
  });

  it('produces no findings when there are no hints', () => {
    expect(evaluatePreloadHints([])).toHaveLength(0);
  });

  it('carries a resolved selector through to targetSelector, when the preloaded resource has a visible on-page usage', () => {
    const hints: PreloadHint[] = [{ path: '/hero.jpg', selector: 'img.hero', reason: 'preload' }];
    expect(evaluatePreloadHints(hints)[0].targetSelector).toBe('img.hero');
  });

  it('leaves targetSelector undefined rather than pointing at the invisible <link> itself, when nothing visible uses the preloaded resource', () => {
    const hints: PreloadHint[] = [{ path: '/unused.jpg', reason: 'preload' }];
    expect(evaluatePreloadHints(hints)[0].targetSelector).toBeUndefined();
  });
});

describe('evaluateMeasurementScope', () => {
  it('notes (not warns) when on a recognized preview/live host', () => {
    const findings = evaluateMeasurementScope({ matched: true, host: 'aem.page', ref: 'main', repo: 'site', owner: 'owner', combined: 'main--site--owner' });
    expect(findings[0].severity).toBe('idle');
    expect(findings[0].title).toContain('aem.page');
  });

  it('applies the same caveat on .aem.live, since the docs group it with .aem.page as non-production', () => {
    const findings = evaluateMeasurementScope({ matched: true, host: 'aem.live', ref: 'main', repo: 'site', owner: 'owner', combined: 'main--site--owner' });
    expect(findings[0].title).toContain('aem.live');
  });

  it('produces no finding on an unrecognized (likely custom production) domain', () => {
    expect(evaluateMeasurementScope({ matched: false })).toHaveLength(0);
  });
});
