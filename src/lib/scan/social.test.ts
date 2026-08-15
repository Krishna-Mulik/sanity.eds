import { describe, it, expect } from 'vitest';
import { evaluateSocial, type SocialRawData } from './social';

function base(overrides: Partial<SocialRawData> = {}): SocialRawData {
  return {
    title: 'Trail packs built for the long approach',
    description: 'A description.',
    og: { 'og:title': null, 'og:description': null, 'og:image': null, 'og:url': null, 'og:type': null },
    twitter: { 'twitter:card': null, 'twitter:title': null, 'twitter:description': null, 'twitter:image': null },
    ogImage: null,
    ...overrides,
  };
}

function withOg(og: Record<string, string | null>): SocialRawData {
  return base({ og: { ...base().og, ...og } });
}

describe('evaluateSocial — og:title/description', () => {
  it('flags missing og:title and og:description as critical', () => {
    const { findings } = evaluateSocial(base());
    expect(findings.find((f) => f.id === 'meta-og-title')?.severity).toBe('critical');
    expect(findings.find((f) => f.id === 'meta-og-description')?.severity).toBe('critical');
  });

  it('reports a well-sized og:title as normal with its length', () => {
    const { findings } = evaluateSocial(withOg({ 'og:title': 'A perfectly reasonable title' }));
    const finding = findings.find((f) => f.id === 'meta-og-title');
    expect(finding?.severity).toBe('normal');
    expect(finding?.detail).toMatch(/28 characters/);
  });

  it('warns on an overlong og:title', () => {
    const { findings } = evaluateSocial(withOg({ 'og:title': 'A'.repeat(90) }));
    expect(findings.find((f) => f.id === 'meta-og-title')?.severity).toBe('warning');
  });
});

describe('evaluateSocial — og:image', () => {
  it('flags a missing og:image as critical', () => {
    const { findings } = evaluateSocial(base());
    expect(findings.find((f) => f.id === 'meta-og-image')?.severity).toBe('critical');
  });

  it('flags an og:image that failed to load as critical', () => {
    const { findings } = evaluateSocial(withOg({ 'og:image': 'https://example.com/broken.png' }));
    const finding = findings.find((f) => f.id === 'meta-og-image');
    expect(finding?.severity).toBe('critical');
    expect(finding?.title).toMatch(/failed to load/);
  });

  it('reports a loaded image as normal and includes its dimensions', () => {
    const raw = withOg({ 'og:image': 'https://example.com/ok.png' });
    raw.ogImage = { ok: true, width: 1200, height: 630 };
    const { findings } = evaluateSocial(raw);
    const finding = findings.find((f) => f.id === 'meta-og-image');
    expect(finding?.severity).toBe('normal');
    expect(finding?.detail).toBe('1200×630');
  });

  it('warns when the image is smaller than platforms recommend', () => {
    const raw = withOg({ 'og:image': 'https://example.com/tiny.png' });
    raw.ogImage = { ok: true, width: 100, height: 100 };
    const { findings } = evaluateSocial(raw);
    expect(findings.find((f) => f.id === 'meta-og-image-size')?.severity).toBe('warning');
  });

  it('warns when the aspect ratio is far from the ~1.91:1 recommendation', () => {
    const raw = withOg({ 'og:image': 'https://example.com/square.png' });
    raw.ogImage = { ok: true, width: 800, height: 800 };
    const { findings } = evaluateSocial(raw);
    expect(findings.find((f) => f.id === 'meta-og-image-ratio')?.severity).toBe('warning');
  });

  it('does not warn about a well-proportioned, adequately sized image', () => {
    const raw = withOg({ 'og:image': 'https://example.com/hero.png' });
    raw.ogImage = { ok: true, width: 1200, height: 630 };
    const { findings } = evaluateSocial(raw);
    expect(findings.some((f) => f.id === 'meta-og-image-size' || f.id === 'meta-og-image-ratio')).toBe(false);
  });
});

describe('evaluateSocial — twitter fallbacks', () => {
  it('falls back to og:title/og:description/og:image and marks that as normal, not a failure', () => {
    const raw = withOg({ 'og:title': 'Title', 'og:description': 'Description here', 'og:image': 'https://example.com/a.png' });
    const { findings } = evaluateSocial(raw);
    expect(findings.find((f) => f.id === 'meta-twitter-title')?.title).toMatch(/falls back/);
    expect(findings.find((f) => f.id === 'meta-twitter-description')?.title).toMatch(/falls back/);
    expect(findings.find((f) => f.id === 'meta-twitter-image')?.title).toMatch(/falls back/);
    expect(findings.every((f) => f.id.startsWith('meta-twitter-') ? f.severity !== 'critical' : true)).toBe(true);
  });

  it('warns when there is nothing to fall back to', () => {
    const { findings } = evaluateSocial(base());
    expect(findings.find((f) => f.id === 'meta-twitter-title')?.severity).toBe('warning');
    expect(findings.find((f) => f.id === 'meta-twitter-description')?.severity).toBe('warning');
    expect(findings.find((f) => f.id === 'meta-twitter-image')?.severity).toBe('warning');
  });
});

describe('evaluateSocial — twitter:card', () => {
  it('recognizes summary_large_image', () => {
    const findings = evaluateSocial(base({ twitter: { ...base().twitter, 'twitter:card': 'summary_large_image' } })).findings;
    expect(findings.find((f) => f.id === 'meta-twitter-card')?.severity).toBe('normal');
    expect(findings.find((f) => f.id === 'meta-twitter-card')?.title).toMatch(/large image/);
  });

  it('flags an unrecognized twitter:card value', () => {
    const findings = evaluateSocial(base({ twitter: { ...base().twitter, 'twitter:card': 'bogus' } })).findings;
    expect(findings.find((f) => f.id === 'meta-twitter-card')?.severity).toBe('warning');
  });
});

describe('evaluateSocial — cards', () => {
  it('builds one card per platform: Facebook, X, LinkedIn, WhatsApp, Discord', () => {
    const { cards } = evaluateSocial(withOg({ 'og:title': 'OG Title', 'og:image': 'https://example.com/img.png' }));
    expect(cards.map((c) => c.platform)).toEqual(['Facebook', 'X', 'LinkedIn', 'WhatsApp', 'Discord']);
    expect(cards.every((c) => c.title === 'OG Title')).toBe(true);
    expect(cards.every((c) => c.imageUrl === 'https://example.com/img.png')).toBe(true);
  });

  it('falls back to the document title when og:title is absent', () => {
    const { cards } = evaluateSocial(base());
    expect(cards[0].title).toBe('Trail packs built for the long approach');
  });
});
