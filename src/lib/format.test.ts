import { describe, it, expect } from 'vitest';
import { formatBytes, relativizeUrl } from './format';

describe('formatBytes', () => {
  it('formats sub-MB sizes in KB', () => {
    expect(formatBytes(62 * 1024)).toBe('62 KB');
  });

  it('formats MB-and-up sizes with one decimal', () => {
    expect(formatBytes(41 * 1024 * 1024)).toBe('41.0 MB');
  });
});

describe('relativizeUrl', () => {
  it('drops the origin for a same-origin URL', () => {
    expect(relativizeUrl('https://example.com/icons/brand-mark.svg', 'https://example.com')).toBe('/icons/brand-mark.svg');
  });

  it('preserves query string and hash for a same-origin URL', () => {
    expect(relativizeUrl('https://example.com/page?x=1#top', 'https://example.com')).toBe('/page?x=1#top');
  });

  it('returns "/" for a same-origin root URL', () => {
    expect(relativizeUrl('https://example.com/', 'https://example.com')).toBe('/');
  });

  it('leaves a cross-origin URL untouched', () => {
    expect(relativizeUrl('https://cdn.example.com/lib.js', 'https://example.com')).toBe('https://cdn.example.com/lib.js');
  });

  it('leaves an unparseable URL untouched', () => {
    expect(relativizeUrl('not a url', 'https://example.com')).toBe('not a url');
  });
});
