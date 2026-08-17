import { describe, it, expect } from 'vitest';
import { evaluateFavicon, resolveFaviconUrl, type FaviconRawData } from './favicon';

function raw(overrides: Partial<FaviconRawData> = {}): FaviconRawData {
  return { faviconHref: 'https://example.com/favicon.svg', ...overrides };
}

describe('resolveFaviconUrl', () => {
  it('uses the explicit <link> href when present', () => {
    expect(resolveFaviconUrl(raw({ faviconHref: 'https://example.com/icon.svg' }), 'https://example.com')).toBe('https://example.com/icon.svg');
  });

  it('falls back to the conventional same-origin /favicon.ico when no <link> is present — the path a browser itself requests', () => {
    expect(resolveFaviconUrl(raw({ faviconHref: null }), 'https://example.com')).toBe('https://example.com/favicon.ico');
  });
});

describe('evaluateFavicon', () => {
  it('warns "No favicon found" when neither an explicit link nor the conventional /favicon.ico resolves', () => {
    const findings = evaluateFavicon(raw({ faviconHref: null }), false, 'https://example.com');
    const finding = findings.find((f) => f.id === 'seo-favicon-missing');
    expect(finding?.severity).toBe('warning');
    expect(finding?.title).toBe('No favicon found');
    expect(finding?.path).toBe('/favicon.ico');
  });

  it(
    'does not flag a site with no <link rel="icon"> at all, as long as the conventional /favicon.ico resolves — ' +
      "this is EDS's default boilerplate setup, confirmed against a real deployed site",
    () => {
      const findings = evaluateFavicon(raw({ faviconHref: null }), true, 'https://example.com');
      expect(findings).toHaveLength(0);
    },
  );

  it('flags an explicit favicon link that fails to load as critical, distinct from a missing link entirely', () => {
    const findings = evaluateFavicon(raw(), false);
    const finding = findings.find((f) => f.id === 'seo-favicon-missing');
    expect(finding?.severity).toBe('critical');
    expect(finding?.title).toBe('Favicon link is broken');
  });

  it('shows a same-origin broken favicon without repeating this site\'s own domain', () => {
    const findings = evaluateFavicon(raw({ faviconHref: 'https://example.com/favicon.svg' }), false, 'https://example.com');
    expect(findings.find((f) => f.id === 'seo-favicon-missing')?.path).toBe('/favicon.svg');
  });

  it('shows a cross-origin broken favicon with its full domain', () => {
    const findings = evaluateFavicon(raw({ faviconHref: 'https://cdn.example.com/favicon.svg' }), false, 'https://example.com');
    expect(findings.find((f) => f.id === 'seo-favicon-missing')?.path).toBe('https://cdn.example.com/favicon.svg');
  });

  it('does not flag a favicon that loads fine', () => {
    const findings = evaluateFavicon(raw(), true);
    expect(findings).toHaveLength(0);
  });
});
