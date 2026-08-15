import { describe, it, expect } from 'vitest';
import { buildSelector } from './selector';

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('buildSelector', () => {
  it('prefers a data-sanity-target attribute when present', () => {
    const doc = parse('<body><img data-sanity-target="hero-image" src="a.png"></body>');
    const el = doc.querySelector('img')!;
    expect(buildSelector(el)).toBe('[data-sanity-target="hero-image"]');
  });

  it('prefers an id when present and unique', () => {
    const doc = parse('<body><p id="intro">hi</p></body>');
    const el = doc.querySelector('p')!;
    expect(buildSelector(el)).toBe('#intro');
  });

  it('falls back to an nth-of-type chain and round-trips to the same element', () => {
    const doc = parse(`
      <body>
        <main>
          <img src="a.png">
          <img src="b.png">
          <img src="c.png">
        </main>
      </body>
    `);
    const imgs = Array.from(doc.querySelectorAll('img'));
    const target = imgs[1];
    const selector = buildSelector(target);
    expect(doc.querySelector(selector)).toBe(target);
  });

  it('round-trips for every element in a realistically nested page', () => {
    const doc = parse(`
      <body>
        <header><nav><a href="#">One</a><a href="#">Two</a></nav></header>
        <main>
          <section><h2>Title</h2><p>Body</p></section>
          <section><h2>Title</h2><img src="x.png"></section>
        </main>
      </body>
    `);
    const all = Array.from(doc.querySelectorAll('*'));
    for (const el of all) {
      const selector = buildSelector(el);
      expect(doc.querySelector(selector)).toBe(el);
    }
  });
});
