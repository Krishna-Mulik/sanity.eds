import { describe, it, expect } from 'vitest';
import { evaluateLinks, type LinkInfo, type LinkCheckResult } from './links';

function link(overrides: Partial<LinkInfo> = {}): LinkInfo {
  const href = overrides.href ?? 'https://example.com/a';
  return {
    href,
    url: new URL(href),
    checkable: true,
    internal: true,
    hasTitle: false,
    text: 'Read more',
    selector: 'a',
    ...overrides,
  };
}

describe('evaluateLinks — stats', () => {
  it('counts total, unique, internal and external links', () => {
    const links = [
      link({ href: 'https://example.com/a', selector: 'a:nth-of-type(1)' }),
      link({ href: 'https://example.com/a', selector: 'a:nth-of-type(2)' }),
      link({ href: 'https://other.com/b', internal: false, selector: 'a:nth-of-type(3)' }),
    ];
    const { stats } = evaluateLinks(links, new Map());
    expect(stats.total).toBe(3);
    expect(stats.unique).toBe(2);
    expect(stats.internal).toBe(2);
    expect(stats.external).toBe(1);
  });

  it('counts links missing a title attribute regardless of visible text', () => {
    const links = [link({ hasTitle: false }), link({ hasTitle: true, selector: 'a:nth-of-type(2)' })];
    const { stats } = evaluateLinks(links, new Map());
    expect(stats.missingTitle).toBe(1);
  });
});

describe('evaluateLinks — broken links', () => {
  it('reports a checked-and-broken same-origin link as critical with its status', () => {
    const l = link({ href: 'https://example.com/missing' });
    const checks = new Map<string, LinkCheckResult>([[l.url!.href, { broken: true, status: 404, reason: 'http-error' }]]);
    const { findings } = evaluateLinks([l], checks);
    const finding = findings.find((f) => f.id === `links-broken-${l.url!.href}`);
    expect(finding?.severity).toBe('critical');
    expect(finding?.title).toContain('404');
  });

  it('does not report a cross-origin-unknown result as broken', () => {
    const l = link({ href: 'https://other.com/a', internal: false });
    const checks = new Map<string, LinkCheckResult>([[l.url!.href, { broken: false, reason: 'cross-origin-unknown' }]]);
    const { findings, stats } = evaluateLinks([l], checks);
    expect(findings.some((f) => f.id.startsWith('links-broken'))).toBe(false);
    expect(stats.broken).toBe(0);
  });

  it('shows a same-origin broken link without repeating this site\'s own domain', () => {
    const l = link({ href: 'https://example.com/missing', internal: true, selector: 'a' });
    const checks = new Map<string, LinkCheckResult>([[l.url!.href, { broken: true, status: 404, reason: 'http-error' }]]);
    const { findings } = evaluateLinks([l], checks);
    const finding = findings.find((f) => f.id === `links-broken-${l.url!.href}`);
    expect(finding?.path).toBe('/missing');
  });

  it('shows a cross-origin broken link with its full domain, since the domain is the point', () => {
    const l = link({ href: 'https://other.com/gone', internal: false, selector: 'a' });
    const checks = new Map<string, LinkCheckResult>([[l.url!.href, { broken: true, status: 404, reason: 'http-error' }]]);
    const { findings } = evaluateLinks([l], checks);
    const finding = findings.find((f) => f.id === `links-broken-${l.url!.href}`);
    expect(finding?.path).toBe('https://other.com/gone');
  });
});

describe('evaluateLinks — does not duplicate accessibility checks', () => {
  it('never produces an accessible-name finding — axe-core\'s link-name rule covers that in the Accessibility section', () => {
    const l = link({ text: '', hasTitle: false });
    const { findings } = evaluateLinks([l], new Map());
    expect(findings.some((f) => f.id.startsWith('links-no-name'))).toBe(false);
  });
});
