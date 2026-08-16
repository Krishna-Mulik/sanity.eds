import { describe, it, expect } from 'vitest';
import {
  evaluateSeo,
  buildSeoPageInfo,
  evaluateCanonicalStatus,
  selectImagesMissingAlt,
  type SeoRawData,
  type CanonicalCheckResult,
  type RawImageInfo,
} from './seo';

function base(overrides: Partial<SeoRawData> = {}): SeoRawData {
  return {
    title: 'A perfectly reasonable page title',
    metaDescription: 'A meta description that sits comfortably inside the recommended length range for search results.',
    canonicalHref: 'https://example.com/page',
    currentUrl: 'https://example.com/page',
    viewportPresent: true,
    robotsContent: null,
    keywordsContent: null,
    authorContent: null,
    publisherContent: null,
    htmlLang: 'en',
    imageCount: 0,
    headings: [{ level: 1, text: 'Title', selector: 'h1' }],
    textNodes: [],
    fontsUsed: [],
    imagesMissingAlt: [],
    ...overrides,
  };
}

describe('evaluateSeo — canonical', () => {
  it('warns when canonical is missing', () => {
    const findings = evaluateSeo(base({ canonicalHref: null }));
    expect(findings.find((f) => f.id === 'seo-canonical-missing')?.severity).toBe('warning');
  });

  it('warns when canonical is relative', () => {
    const findings = evaluateSeo(base({ canonicalHref: '/page' }));
    expect(findings.find((f) => f.id === 'seo-canonical-relative')?.severity).toBe('warning');
  });

  it('is clean when canonical matches the current absolute URL', () => {
    const findings = evaluateSeo(base());
    expect(findings.some((f) => f.id.startsWith('seo-canonical'))).toBe(false);
  });

  it('notes (not errors) when canonical points to a different page', () => {
    const findings = evaluateSeo(base({ canonicalHref: 'https://example.com/other-page' }));
    expect(findings.find((f) => f.id === 'seo-canonical-mismatch')?.severity).toBe('idle');
  });
});

describe('evaluateSeo — title & description', () => {
  it('flags a missing title as critical', () => {
    const findings = evaluateSeo(base({ title: null }));
    expect(findings.find((f) => f.id === 'seo-title-missing')?.severity).toBe('critical');
  });

  it('flags an overlong title', () => {
    const findings = evaluateSeo(base({ title: 'A'.repeat(80) }));
    expect(findings.find((f) => f.id === 'seo-title-long')).toBeTruthy();
  });

  it('flags a missing description as a warning', () => {
    const findings = evaluateSeo(base({ metaDescription: null }));
    expect(findings.find((f) => f.id === 'seo-description-missing')?.severity).toBe('warning');
  });

  it('reports a well-sized title/description as normal, not silently — so the checklist always shows every check', () => {
    const findings = evaluateSeo(base());
    expect(findings.find((f) => f.id === 'seo-title-present')?.severity).toBe('normal');
    expect(findings.find((f) => f.id === 'seo-description-present')?.severity).toBe('normal');
  });
});

describe('evaluateSeo — spelling', () => {
  it('catches a known common misspelling and reports the correction once', () => {
    const findings = evaluateSeo(
      base({
        textNodes: [
          { text: 'Since 2014 we recieve real trail miles.', selector: 'p' },
          { text: 'We always recieve feedback.', selector: 'p:nth-of-type(2)' },
        ],
      }),
    );
    const matches = findings.filter((f) => f.id === 'seo-spelling-recieve');
    expect(matches).toHaveLength(1);
    expect(matches[0].detail).toMatch(/receive/);
  });

  it('does not flag correctly spelled text', () => {
    const findings = evaluateSeo(base({ textNodes: [{ text: 'Everything here is spelled correctly.', selector: 'p' }] }));
    expect(findings.some((f) => f.id.startsWith('seo-spelling'))).toBe(false);
  });
});

describe('evaluateSeo — does not duplicate accessibility checks', () => {
  it('never produces heading findings, even with a broken hierarchy — axe-core covers heading order/presence in the Accessibility section', () => {
    const findings = evaluateSeo(
      base({
        headings: [
          { level: 1, text: 'a', selector: 'h1:nth-of-type(1)' },
          { level: 1, text: 'b', selector: 'h1:nth-of-type(2)' },
          { level: 4, text: 'c', selector: 'h4' },
        ],
      }),
    );
    expect(findings.some((f) => f.id.startsWith('seo-h1') || f.id.startsWith('seo-heading'))).toBe(false);
  });
});

describe('buildSeoPageInfo', () => {
  it('tallies heading counts per level, index 0 = H1', () => {
    const info = buildSeoPageInfo(
      base({
        headings: [
          { level: 1, text: 'a', selector: 'h1' },
          { level: 2, text: 'b', selector: 'h2:nth-of-type(1)' },
          { level: 2, text: 'c', selector: 'h2:nth-of-type(2)' },
        ],
      }),
    );
    expect(info.headingCounts).toEqual([1, 2, 0, 0, 0, 0]);
  });

  it('passes through keywords/author/publisher/lang as-is, with no severity judgment attached', () => {
    const info = buildSeoPageInfo(
      base({ keywordsContent: 'trail, packs', authorContent: 'Jane Doe', publisherContent: 'Cairn Supply Co.', htmlLang: 'en-US' }),
    );
    expect(info.keywordsContent).toBe('trail, packs');
    expect(info.authorContent).toBe('Jane Doe');
    expect(info.publisherContent).toBe('Cairn Supply Co.');
    expect(info.lang).toBe('en-US');
  });

  it('carries the image count through unchanged', () => {
    const info = buildSeoPageInfo(base({ imageCount: 4 }));
    expect(info.imageCount).toBe(4);
  });

  it('carries the canonical href through unchanged', () => {
    const info = buildSeoPageInfo(base({ canonicalHref: 'https://example.com/page' }));
    expect(info.canonicalHref).toBe('https://example.com/page');
  });

  it('carries the headings through in document order for the outline display', () => {
    const headings = [
      { level: 1, text: 'a', selector: 'h1' },
      { level: 3, text: 'b', selector: 'h3' },
    ];
    const info = buildSeoPageInfo(base({ headings }));
    expect(info.headings).toEqual(headings);
  });

  it('carries the fonts-used list through unchanged', () => {
    const info = buildSeoPageInfo(base({ fontsUsed: ['Inter', 'Georgia'] }));
    expect(info.fontsUsed).toEqual(['Inter', 'Georgia']);
  });

  it('carries the images-missing-alt list through unchanged', () => {
    const imagesMissingAlt = [{ selector: 'img.hero', src: 'https://example.com/hero.jpg' }];
    const info = buildSeoPageInfo(base({ imagesMissingAlt }));
    expect(info.imagesMissingAlt).toEqual(imagesMissingAlt);
  });
});

describe('selectImagesMissingAlt', () => {
  function image(overrides: Partial<RawImageInfo> = {}): RawImageInfo {
    return { hasAlt: false, role: null, ariaHidden: null, selector: 'img.hero', src: 'https://example.com/hero.jpg', ...overrides };
  }

  it('flags an image with no alt attribute at all', () => {
    const result = selectImagesMissingAlt([image()]);
    expect(result).toEqual([{ selector: 'img.hero', src: 'https://example.com/hero.jpg' }]);
  });

  it('does not flag an image that has an alt attribute, even an empty one — that is a different, separate check', () => {
    expect(selectImagesMissingAlt([image({ hasAlt: true })])).toHaveLength(0);
  });

  it('does not flag an image explicitly marked decorative via role="presentation" or role="none"', () => {
    expect(selectImagesMissingAlt([image({ role: 'presentation' })])).toHaveLength(0);
    expect(selectImagesMissingAlt([image({ role: 'none' })])).toHaveLength(0);
  });

  it('does not flag an image explicitly hidden from the accessibility tree via aria-hidden="true"', () => {
    expect(selectImagesMissingAlt([image({ ariaHidden: 'true' })])).toHaveLength(0);
  });
});

describe('evaluateCanonicalStatus', () => {
  it('produces no finding when there is no canonical to check', () => {
    expect(evaluateCanonicalStatus(null, { status: 'not-checked' })).toHaveLength(0);
  });

  it('produces no finding when the canonical returns a clean 2xx', () => {
    expect(evaluateCanonicalStatus('https://example.com/page', { status: 'ok', httpStatus: 200 })).toHaveLength(0);
  });

  it('warns when the canonical URL responds with a redirect', () => {
    const check: CanonicalCheckResult = { status: 'redirected', httpStatus: 301 };
    const findings = evaluateCanonicalStatus('https://example.com/page', check);
    expect(findings.find((f) => f.id === 'seo-canonical-status-redirect')?.severity).toBe('warning');
  });

  it('flags the canonical URL as critical when it returns an error status', () => {
    const check: CanonicalCheckResult = { status: 'http-error', httpStatus: 404 };
    const findings = evaluateCanonicalStatus('https://example.com/page', check);
    const finding = findings.find((f) => f.id === 'seo-canonical-status-error');
    expect(finding?.severity).toBe('critical');
    expect(finding?.detail).toMatch(/404/);
  });

  it('flags an unreachable canonical URL as critical', () => {
    const findings = evaluateCanonicalStatus('https://example.com/page', { status: 'network-error' });
    expect(findings.find((f) => f.id === 'seo-canonical-status-unreachable')?.severity).toBe('critical');
  });

  it('notes (not flags) a cross-origin canonical as unverifiable', () => {
    const findings = evaluateCanonicalStatus('https://cdn.example.com/page', { status: 'cross-origin-unchecked' });
    expect(findings.find((f) => f.id === 'seo-canonical-status-cross-origin')?.severity).toBe('idle');
  });
});
