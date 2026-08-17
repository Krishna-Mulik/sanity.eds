import { describe, it, expect } from 'vitest';
import { computeConsistencyUrls } from './consistency';
import type { GithubRefInfo } from './siteLimits';

function win(href: string): Window {
  const url = new URL(href);
  return { location: url } as unknown as Window;
}

describe('computeConsistencyUrls', () => {
  it('swaps .aem.page for .aem.live, keeping the same ref--repo--owner and path', () => {
    const ref: GithubRefInfo = { matched: true, ref: 'main', repo: 'site', owner: 'owner', combined: 'main--site--owner', host: 'aem.page' };
    const result = computeConsistencyUrls(ref, win('https://main--site--owner.aem.page/products/widget?x=1'));
    expect(result).toEqual({
      currentUrl: 'https://main--site--owner.aem.page/products/widget?x=1',
      currentHost: 'aem.page',
      counterpartUrl: 'https://main--site--owner.aem.live/products/widget?x=1',
      counterpartHost: 'aem.live',
    });
  });

  it('swaps .aem.live back to .aem.page (the reverse direction)', () => {
    const ref: GithubRefInfo = { matched: true, ref: 'main', repo: 'site', owner: 'owner', combined: 'main--site--owner', host: 'aem.live' };
    const result = computeConsistencyUrls(ref, win('https://main--site--owner.aem.live/'));
    expect(result?.counterpartUrl).toBe('https://main--site--owner.aem.page/');
  });

  it('handles the legacy .hlx.page/.hlx.live hosts the same way', () => {
    const ref: GithubRefInfo = { matched: true, ref: 'main', repo: 'site', owner: 'owner', combined: 'main--site--owner', host: 'hlx.page' };
    const result = computeConsistencyUrls(ref, win('https://main--site--owner.hlx.page/'));
    expect(result?.counterpartUrl).toBe('https://main--site--owner.hlx.live/');
  });

  it('returns null when the host is not a recognized preview/live host', () => {
    const ref: GithubRefInfo = { matched: false };
    expect(computeConsistencyUrls(ref, win('https://example.com/'))).toBeNull();
  });
});
