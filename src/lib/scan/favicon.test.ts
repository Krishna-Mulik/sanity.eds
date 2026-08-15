import { describe, it, expect } from 'vitest';
import { evaluateFavicon, type FaviconRawData } from './favicon';

function raw(overrides: Partial<FaviconRawData> = {}): FaviconRawData {
  return { faviconHref: 'https://example.com/favicon.svg', ...overrides };
}

describe('evaluateFavicon', () => {
  it('warns when no favicon link is present', () => {
    const findings = evaluateFavicon(raw({ faviconHref: null }), null);
    expect(findings.find((f) => f.id === 'seo-favicon-missing')?.severity).toBe('warning');
  });

  it('flags a favicon link that fails to load as critical', () => {
    const findings = evaluateFavicon(raw(), false);
    expect(findings.find((f) => f.id === 'seo-favicon-broken')?.severity).toBe('critical');
  });

  it('shows a same-origin broken favicon without repeating this site\'s own domain', () => {
    const findings = evaluateFavicon(raw({ faviconHref: 'https://example.com/favicon.svg' }), false, 'https://example.com');
    expect(findings.find((f) => f.id === 'seo-favicon-broken')?.path).toBe('/favicon.svg');
  });

  it('shows a cross-origin broken favicon with its full domain', () => {
    const findings = evaluateFavicon(raw({ faviconHref: 'https://cdn.example.com/favicon.svg' }), false, 'https://example.com');
    expect(findings.find((f) => f.id === 'seo-favicon-broken')?.path).toBe('https://cdn.example.com/favicon.svg');
  });

  it('does not flag a favicon that loads fine', () => {
    const findings = evaluateFavicon(raw(), true);
    expect(findings).toHaveLength(0);
  });
});
