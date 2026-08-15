import { describe, it, expect } from 'vitest';
import {
  evaluateSiteLimits,
  gatherGithubRef,
  parseRobotsTxt,
  type GithubRefInfo,
  type SitemapInfo,
  type RedirectsInfo,
  type JsonSheetInfo,
  type JsonSheets,
  type RobotsInfo,
  type NotFoundInfo,
} from './siteLimits';

function winWithHost(hostname: string) {
  return { location: { hostname } } as Window;
}

function ref(overrides: Partial<GithubRefInfo> = {}): GithubRefInfo {
  return { matched: true, ref: 'main', repo: 'cairn-site', owner: 'cairn-supply', combined: 'main--cairn-site--cairn-supply', host: 'aem.live', ...overrides };
}
function sitemap(overrides: Partial<SitemapInfo> = {}): SitemapInfo {
  return { found: true, url: '/sitemap.xml', bytes: 1024, pageCount: 100, ...overrides };
}
function redirects(overrides: Partial<RedirectsInfo> = {}): RedirectsInfo {
  return { found: true, url: '/redirects.json', count: 5, ...overrides };
}
function sheet(overrides: Partial<JsonSheetInfo> = {}): JsonSheetInfo {
  return { found: true, url: '/query-index.json', bytes: 1024, rowCount: 100, ...overrides };
}
function jsonSheets(overrides: Partial<JsonSheets> = {}): JsonSheets {
  return {
    queryIndex: sheet({ url: '/query-index.json' }),
    metadata: sheet({ url: '/metadata.json', rowCount: undefined }),
    placeholders: sheet({ url: '/placeholders.json', rowCount: undefined }),
    ...overrides,
  };
}
function robots(overrides: Partial<RobotsInfo> = {}): RobotsInfo {
  return { found: true, url: '/robots.txt', sitemapUrls: ['https://example.com/sitemap.xml'], disallowsAll: false, ...overrides };
}
function notFound(overrides: Partial<NotFoundInfo> = {}): NotFoundInfo {
  return { checked: true, status: 404, ...overrides };
}

describe('gatherGithubRef', () => {
  it('parses ref--repo--owner off an aem.page hostname', () => {
    const info = gatherGithubRef(winWithHost('main--cairn-site--cairn-supply.aem.page'));
    expect(info).toEqual({
      matched: true,
      ref: 'main',
      repo: 'cairn-site',
      owner: 'cairn-supply',
      combined: 'main--cairn-site--cairn-supply',
      host: 'aem.page',
    });
  });

  it('also parses aem.live and legacy hlx.page/hlx.live hosts', () => {
    expect(gatherGithubRef(winWithHost('main--a--b.aem.live')).matched).toBe(true);
    expect(gatherGithubRef(winWithHost('main--a--b.hlx.page')).matched).toBe(true);
    expect(gatherGithubRef(winWithHost('main--a--b.hlx.live')).matched).toBe(true);
  });

  it('does not match a custom domain', () => {
    expect(gatherGithubRef(winWithHost('www.cairnsupply.com')).matched).toBe(false);
  });

  it('handles multi-part ref/branch names with extra dashes correctly enough to still find three parts', () => {
    const info = gatherGithubRef(winWithHost('feature-foo--cairn-site--cairn-supply.aem.page'));
    expect(info.matched).toBe(true);
    expect(info.repo).toBe('cairn-site');
    expect(info.owner).toBe('cairn-supply');
  });
});

describe('evaluateSiteLimits — GitHub ref/repo/owner', () => {
  it('flags a combined ref--repo--owner string over 63 characters', () => {
    const long = ref({ combined: 'a'.repeat(70) });
    const findings = evaluateSiteLimits(long, sitemap(), redirects());
    expect(findings.find((f) => f.id === 'site-ref-length')?.severity).toBe('critical');
  });

  it('does not flag a normal-length ref--repo--owner', () => {
    const findings = evaluateSiteLimits(ref(), sitemap(), redirects());
    expect(findings.find((f) => f.id === 'site-ref-length')).toBeUndefined();
  });

  it('flags disallowed characters in ref/repo/owner', () => {
    const findings = evaluateSiteLimits(ref({ owner: 'Cairn_Supply' }), sitemap(), redirects());
    expect(findings.find((f) => f.id === 'site-ref-naming')?.severity).toBe('critical');
  });

  it('notes when the page is not on a recognized preview/live host', () => {
    const findings = evaluateSiteLimits({ matched: false }, sitemap(), redirects());
    expect(findings.find((f) => f.id === 'site-ref-unknown')?.severity).toBe('idle');
  });
});

describe('evaluateSiteLimits — sitemap', () => {
  it('flags a sitemap over 50k pages', () => {
    const findings = evaluateSiteLimits(ref(), sitemap({ pageCount: 60_000 }), redirects());
    expect(findings.find((f) => f.id === 'site-sitemap-pages')?.severity).toBe('critical');
  });

  it('flags a sitemap over 50MB', () => {
    const findings = evaluateSiteLimits(ref(), sitemap({ bytes: 60 * 1024 * 1024 }), redirects());
    expect(findings.find((f) => f.id === 'site-sitemap-size')?.severity).toBe('critical');
  });

  it('does not flag a small sitemap', () => {
    const findings = evaluateSiteLimits(ref(), sitemap(), redirects());
    expect(findings.some((f) => f.id.startsWith('site-sitemap-') && f.id !== 'site-sitemap-not-found')).toBe(false);
  });

  it('notes (not warns) when no sitemap is found — most sites legitimately have none', () => {
    const findings = evaluateSiteLimits(ref(), { found: false }, redirects());
    expect(findings.find((f) => f.id === 'site-sitemap-not-found')?.severity).toBe('idle');
  });
});

describe('evaluateSiteLimits — redirects', () => {
  it('flags a redirects table over 100k entries', () => {
    const findings = evaluateSiteLimits(ref(), sitemap(), redirects({ count: 100_001 }));
    expect(findings.find((f) => f.id === 'site-redirects')?.severity).toBe('critical');
  });

  it('notes (not warns) when no redirects.json is found', () => {
    const findings = evaluateSiteLimits(ref(), sitemap(), { found: false });
    expect(findings.find((f) => f.id === 'site-redirects-not-found')?.severity).toBe('idle');
  });
});

describe('evaluateSiteLimits — always-present not-checkable notes', () => {
  it('always includes GitHub Code Sync, Admin API, and BYOM notes, each separately', () => {
    const findings = evaluateSiteLimits(ref(), sitemap(), redirects());
    expect(findings.find((f) => f.id === 'site-code-sync-not-checkable')?.severity).toBe('idle');
    expect(findings.find((f) => f.id === 'site-admin-api-not-checkable')?.severity).toBe('idle');
    expect(findings.find((f) => f.id === 'site-byom-not-checkable')?.severity).toBe('idle');
  });

  it('notes the scope of which JSON sheets are checked even when no jsonSheets arg is passed', () => {
    const findings = evaluateSiteLimits(ref(), sitemap(), redirects());
    expect(findings.find((f) => f.id === 'site-json-sheets-scope')?.severity).toBe('idle');
    expect(findings.find((f) => f.id === 'site-query-index-not-found')?.severity).toBe('idle');
    expect(findings.find((f) => f.id === 'site-metadata-not-found')?.severity).toBe('idle');
    expect(findings.find((f) => f.id === 'site-placeholders-not-found')?.severity).toBe('idle');
  });
});

describe('evaluateSiteLimits — query index', () => {
  it('flags a query index over 50k rows as critical', () => {
    const findings = evaluateSiteLimits(ref(), sitemap(), redirects(), jsonSheets({ queryIndex: sheet({ rowCount: 60_000 }) }));
    expect(findings.find((f) => f.id === 'site-query-index-pages')?.severity).toBe('critical');
  });

  it('warns when a query index is nearing 50k rows', () => {
    const findings = evaluateSiteLimits(ref(), sitemap(), redirects(), jsonSheets({ queryIndex: sheet({ rowCount: 45_000 }) }));
    expect(findings.find((f) => f.id === 'site-query-index-pages-warn')?.severity).toBe('warning');
  });

  it('flags query-index.json over the 6MB payload cap as critical', () => {
    const findings = evaluateSiteLimits(ref(), sitemap(), redirects(), jsonSheets({ queryIndex: sheet({ bytes: 7 * 1024 * 1024 }) }));
    expect(findings.find((f) => f.id === 'site-query-index-payload')?.severity).toBe('critical');
  });

  it('does not flag a small query index', () => {
    const findings = evaluateSiteLimits(ref(), sitemap(), redirects(), jsonSheets());
    expect(findings.some((f) => f.id.startsWith('site-query-index-') && !f.id.includes('not-found'))).toBe(false);
  });

  it('notes (not warns) when no query index is found', () => {
    const findings = evaluateSiteLimits(ref(), sitemap(), redirects(), jsonSheets({ queryIndex: { found: false } }));
    expect(findings.find((f) => f.id === 'site-query-index-not-found')?.severity).toBe('idle');
  });
});

describe('evaluateSiteLimits — metadata and placeholders sheets', () => {
  it('flags metadata.json over the 6MB payload cap as critical', () => {
    const findings = evaluateSiteLimits(ref(), sitemap(), redirects(), jsonSheets({ metadata: sheet({ url: '/metadata.json', bytes: 7 * 1024 * 1024 }) }));
    expect(findings.find((f) => f.id === 'site-metadata-payload')?.severity).toBe('critical');
  });

  it('notes (not warns) when no metadata sheet is found', () => {
    const findings = evaluateSiteLimits(ref(), sitemap(), redirects(), jsonSheets({ metadata: { found: false } }));
    expect(findings.find((f) => f.id === 'site-metadata-not-found')?.severity).toBe('idle');
  });

  it('flags placeholders.json over the 6MB payload cap as critical', () => {
    const findings = evaluateSiteLimits(
      ref(),
      sitemap(),
      redirects(),
      jsonSheets({ placeholders: sheet({ url: '/placeholders.json', bytes: 7 * 1024 * 1024 }) }),
    );
    expect(findings.find((f) => f.id === 'site-placeholders-payload')?.severity).toBe('critical');
  });

  it('notes (not warns) when no placeholders sheet is found', () => {
    const findings = evaluateSiteLimits(ref(), sitemap(), redirects(), jsonSheets({ placeholders: { found: false } }));
    expect(findings.find((f) => f.id === 'site-placeholders-not-found')?.severity).toBe('idle');
  });
});

describe('evaluateSiteLimits — pages approaching the 1M recommended max', () => {
  it('warns when sitemap or query index page count nears 1M', () => {
    const findings = evaluateSiteLimits(ref(), sitemap({ pageCount: 850_000 }), redirects(), jsonSheets());
    expect(findings.find((f) => f.id === 'site-pages-approaching-max')?.severity).toBe('warning');
  });

  it('does not warn for a normal-sized site', () => {
    const findings = evaluateSiteLimits(ref(), sitemap(), redirects(), jsonSheets());
    expect(findings.find((f) => f.id === 'site-pages-approaching-max')).toBeUndefined();
  });
});

describe('parseRobotsTxt', () => {
  it('collects Sitemap directives', () => {
    const { sitemapUrls } = parseRobotsTxt('User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml');
    expect(sitemapUrls).toEqual(['https://example.com/sitemap.xml']);
  });

  it('detects a blanket Disallow: / under User-agent: *', () => {
    const { disallowsAll } = parseRobotsTxt('User-agent: *\nDisallow: /');
    expect(disallowsAll).toBe(true);
  });

  it('does not flag a Disallow scoped to a specific path', () => {
    const { disallowsAll } = parseRobotsTxt('User-agent: *\nDisallow: /admin');
    expect(disallowsAll).toBe(false);
  });

  it('does not flag Disallow: / scoped to a named (non-wildcard) user-agent', () => {
    const { disallowsAll } = parseRobotsTxt('User-agent: BadBot\nDisallow: /');
    expect(disallowsAll).toBe(false);
  });

  it('ignores comments and blank lines', () => {
    const { sitemapUrls, disallowsAll } = parseRobotsTxt('# comment\n\nUser-agent: *\n\nAllow: /\nSitemap: https://example.com/sitemap.xml');
    expect(sitemapUrls).toEqual(['https://example.com/sitemap.xml']);
    expect(disallowsAll).toBe(false);
  });
});

describe('evaluateSiteLimits — robots.txt', () => {
  it('warns when no robots.txt is found', () => {
    const findings = evaluateSiteLimits(ref(), sitemap(), redirects(), jsonSheets(), { found: false, sitemapUrls: [], disallowsAll: false });
    expect(findings.find((f) => f.id === 'site-robots-not-found')?.severity).toBe('warning');
  });

  it('flags a blanket Disallow: / as critical', () => {
    const findings = evaluateSiteLimits(ref(), sitemap(), redirects(), jsonSheets(), robots({ disallowsAll: true }));
    expect(findings.find((f) => f.id === 'site-robots-disallow-all')?.severity).toBe('critical');
  });

  it('warns when robots.txt has no Sitemap directive', () => {
    const findings = evaluateSiteLimits(ref(), sitemap(), redirects(), jsonSheets(), robots({ sitemapUrls: [] }));
    expect(findings.find((f) => f.id === 'site-robots-sitemap-missing')?.severity).toBe('warning');
  });

  it('does not flag a healthy robots.txt', () => {
    const findings = evaluateSiteLimits(ref(), sitemap(), redirects(), jsonSheets(), robots());
    expect(findings.some((f) => f.id.startsWith('site-robots-') && f.id !== 'site-robots-not-found')).toBe(false);
  });
});

describe('evaluateSiteLimits — custom 404 behavior', () => {
  it('warns when a nonexistent path does not return 404', () => {
    const findings = evaluateSiteLimits(ref(), sitemap(), redirects(), jsonSheets(), robots(), notFound({ status: 200 }));
    expect(findings.find((f) => f.id === 'site-404-status')?.severity).toBe('warning');
  });

  it('does not flag a site that correctly 404s', () => {
    const findings = evaluateSiteLimits(ref(), sitemap(), redirects(), jsonSheets(), robots(), notFound({ status: 404 }));
    expect(findings.find((f) => f.id === 'site-404-status')).toBeUndefined();
  });

  it('notes (not warns) when 404 behavior could not be checked at all', () => {
    const findings = evaluateSiteLimits(ref(), sitemap(), redirects(), jsonSheets(), robots(), { checked: false, status: null });
    expect(findings.find((f) => f.id === 'site-404-not-checkable')?.severity).toBe('idle');
  });
});
