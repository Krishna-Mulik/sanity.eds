// Builds a CSS selector that re-locates a real DOM element found during a
// scan, so a Finding's `targetSelector` can drive locate-on-page later.
// Devtools-style: prefer something already stable (data-sanity-target, id),
// else walk up building an nth-of-type chain, stopping as soon as the
// selector built so far is unique in the document.

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value);
  return value.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);
}

function isUnique(selector: string, doc: Document): boolean {
  try {
    return doc.querySelectorAll(selector).length === 1;
  } catch {
    return false;
  }
}

export function buildSelector(el: Element): string {
  const doc = el.ownerDocument;

  const target = el.getAttribute('data-sanity-target');
  if (target) {
    const sel = `[data-sanity-target="${cssEscape(target)}"]`;
    if (isUnique(sel, doc)) return sel;
  }

  if (el.id) {
    const sel = `#${cssEscape(el.id)}`;
    if (isUnique(sel, doc)) return sel;
  }

  const parts: string[] = [];
  let node: Element | null = el;
  while (node && node !== doc.documentElement) {
    const tag = node.tagName.toLowerCase();
    const parent: Element | null = node.parentElement;
    let part = tag;
    if (parent) {
      const siblings = Array.from(parent.children).filter((c) => c.tagName === node!.tagName);
      if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
    }
    parts.unshift(part);
    const candidate = parts.join(' > ');
    if (isUnique(candidate, doc)) return candidate;
    node = parent;
  }

  return parts.join(' > ') || el.tagName.toLowerCase();
}
