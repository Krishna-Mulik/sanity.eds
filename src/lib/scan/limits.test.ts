import { describe, it, expect } from 'vitest';
import { evaluateLimits, type LimitsRawData } from './limits';

function base(overrides: Partial<LimitsRawData> = {}): LimitsRawData {
  return {
    pathLength: 20,
    payloadBytes: 1024,
    redirectCount: 0,
    assets: [],
    longLinkPaths: [],
    ...overrides,
  };
}

describe('evaluateLimits', () => {
  it('flags a path over 900 characters as critical', () => {
    const findings = evaluateLimits(base({ pathLength: 950 }));
    const finding = findings.find((f) => f.id === 'limits-path-length');
    expect(finding?.severity).toBe('critical');
  });

  it('does not flag a short path', () => {
    const findings = evaluateLimits(base({ pathLength: 40 }));
    expect(findings.find((f) => f.id === 'limits-path-length')).toBeUndefined();
  });

  it('flags payload over 6MB as critical and near the cap as warning', () => {
    const over = evaluateLimits(base({ payloadBytes: 7 * 1024 * 1024 }));
    expect(over.find((f) => f.id === 'limits-payload')?.severity).toBe('critical');

    const near = evaluateLimits(base({ payloadBytes: 5.5 * 1024 * 1024 }));
    expect(near.find((f) => f.id === 'limits-payload-warn')?.severity).toBe('warning');

    const fine = evaluateLimits(base({ payloadBytes: 1024 * 1024 }));
    expect(fine.some((f) => f.id.startsWith('limits-payload'))).toBe(false);
  });

  it('flags an SVG over the 40KB cap using the SVG limit, not the image limit', () => {
    const findings = evaluateLimits(
      base({ assets: [{ path: '/icons/brand.svg', kind: 'svg', bytes: 62 * 1024 }] }),
    );
    const finding = findings.find((f) => f.id === 'limits-asset-/icons/brand.svg');
    expect(finding?.severity).toBe('critical');
    expect(finding?.allowed).toBe('40 KB');
  });

  it('flags a video over 36MB and an image under 20MB stays clean', () => {
    const findings = evaluateLimits(
      base({
        assets: [
          { path: '/media/hero.mp4', kind: 'video', bytes: 41 * 1024 * 1024 },
          { path: '/media/hero.png', kind: 'image', bytes: 2 * 1024 * 1024 },
        ],
      }),
    );
    expect(findings.find((f) => f.id === 'limits-asset-/media/hero.mp4')?.severity).toBe('critical');
    expect(findings.some((f) => f.id.includes('/media/hero.png'))).toBe(false);
  });

  it('flags a favicon over 16KB', () => {
    const findings = evaluateLimits(base({ assets: [{ path: '/favicon.ico', kind: 'favicon', bytes: 21 * 1024 }] }));
    expect(findings.find((f) => f.id === 'limits-asset-/favicon.ico')?.severity).toBe('critical');
  });

  it('flags any discovered JSON file over the 6MB payload cap, not just the conventional sheets', () => {
    const findings = evaluateLimits(
      base({ assets: [{ path: '/fragments/nav-tree.json', kind: 'json', bytes: 7 * 1024 * 1024 }] }),
    );
    const finding = findings.find((f) => f.id === 'limits-asset-/fragments/nav-tree.json');
    expect(finding?.severity).toBe('critical');
    expect(finding?.title).toBe('JSON file over the size limit');
    expect(finding?.allowed).toBe('6.0 MB');
  });

  it('does not flag a small discovered JSON file', () => {
    const findings = evaluateLimits(base({ assets: [{ path: '/fragments/nav-tree.json', kind: 'json', bytes: 2 * 1024 }] }));
    expect(findings.some((f) => f.id.includes('nav-tree.json'))).toBe(false);
  });

  it('marks an oversized JSON finding copyable, with no locate selector — JSON has no on-page element to scroll to', () => {
    const findings = evaluateLimits(
      base({ assets: [{ path: '/fragments/nav-tree.json', kind: 'json', bytes: 7 * 1024 * 1024, selector: 'a.nav-link' }] }),
    );
    const finding = findings.find((f) => f.id === 'limits-asset-/fragments/nav-tree.json');
    expect(finding?.copyable).toBe(true);
    expect(finding?.targetSelector).toBeUndefined();
  });

  it('does not mark a non-JSON oversized asset copyable — it keeps its normal locate selector', () => {
    const findings = evaluateLimits(base({ assets: [{ path: '/media/hero.mp4', kind: 'video', bytes: 41 * 1024 * 1024, selector: 'video.hero' }] }));
    const finding = findings.find((f) => f.id === 'limits-asset-/media/hero.mp4');
    expect(finding?.copyable).toBeUndefined();
    expect(finding?.targetSelector).toBe('video.hero');
  });

  it('warns on multiple redirects but not a single one', () => {
    expect(evaluateLimits(base({ redirectCount: 2 })).find((f) => f.id === 'limits-redirects')).toBeTruthy();
    expect(evaluateLimits(base({ redirectCount: 1 })).find((f) => f.id === 'limits-redirects')).toBeUndefined();
  });

  it('says nothing about an asset whose size could not be measured, rather than guessing', () => {
    const findings = evaluateLimits(base({ assets: [{ path: '/media/mystery.png', kind: 'image', bytes: null }] }));
    expect(findings.some((f) => f.id.includes('/media/mystery.png'))).toBe(false);
  });

  it('always includes the docs/spreadsheet not-checkable note', () => {
    const findings = evaluateLimits(base());
    const note = findings.find((f) => f.id === 'limits-docs-not-checkable');
    expect(note?.severity).toBe('idle');
  });

  it('flags a same-origin asset whose file type is outside the supported list', () => {
    const findings = evaluateLimits(base({ assets: [{ path: '/media/clip.gif', kind: 'image', bytes: 1024 }] }));
    const finding = findings.find((f) => f.id === 'limits-unsupported-type-/media/clip.gif');
    expect(finding?.severity).toBe('critical');
    expect(finding?.title).toContain('.gif');
  });

  it('does not flag a supported file type (e.g. webp)', () => {
    const findings = evaluateLimits(base({ assets: [{ path: '/media/hero.webp', kind: 'image', bytes: 1024 }] }));
    expect(findings.some((f) => f.id.startsWith('limits-unsupported-type'))).toBe(false);
  });

  it('does not flag a favicon for file type, even though .ico is outside the general supported list', () => {
    const findings = evaluateLimits(base({ assets: [{ path: '/favicon.ico', kind: 'favicon', bytes: 1024 }] }));
    expect(findings.some((f) => f.id.startsWith('limits-unsupported-type'))).toBe(false);
  });

  it('flags a linked page whose own path is over the 900-character limit, pointing at the link', () => {
    const findings = evaluateLimits(
      base({ longLinkPaths: [{ href: 'https://example.com/' + 'a'.repeat(901), length: 902, selector: 'a.deep-link' }] }),
    );
    const finding = findings.find((f) => f.id.startsWith('limits-link-path-'));
    expect(finding?.severity).toBe('critical');
    expect(finding?.targetSelector).toBe('a.deep-link');
  });
});
