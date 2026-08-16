<!-- title: Sanity -->

# Sanity

An AEM Sidekick plugin for Edge Delivery Services (EDS) sites: a self-contained UI that scans a
live EDS page for performance, SEO, social/OG, security, accessibility, and aem.live-limits
issues, and lets an author or developer jump straight to the offending element on the page.

## 1. Problem

EDS enforces hard [content/code-bus limits](https://www.aem.live/docs/limits) — asset size caps
among them. Go over one and the symptom isn't a helpful error: content changes just silently stop
reflecting on `.live`. Nothing in the authoring UI tells you why. The only trail is the publish
logs, and even those aren't much help — a line like `image [12, 14, 16] svg over 40kb` tells you
*that* three SVGs are too big, not *which* three images on the page they actually are. Someone
then has to manually cross-reference index numbers against the page's DOM by hand, on every
occurrence, every time this happens. That's true of the whole
[keeping-it-100](https://www.aem.live/developer/keeping-it-100) checklist too — LCP payload
budget, early third-party connections, the preload/`fetchpriority` anti-pattern — none of it is
visible from the authoring/preview surface itself; you either know the docs by heart and go
digging, or you ship blind.

Generic auditing tools don't help here either — Lighthouse, SEO browser extensions,
accessibility scanners run separately from the authoring tool and have no concept of EDS at all.
None of them know what an EDS "block" is (a block whose `decorate()` silently threw and rendered
nothing is invisible to all of them), and none check against EDS-specific limits, since those
constraints don't exist outside EDS.

## 2. Fix

Sanity runs inside the same Sidekick surface authors and developers already use — not a separate
dashboard — and checks the live page against real EDS/aem.live rules a generic tool has no way
to know about:

- **Limits** — every same-origin asset (images, SVGs, JSON) measured against the actual
  content-bus size cap, plus sitemap/redirect counts, robots.txt, and JSON-sheet payload caps —
  measured against the documented thresholds, not just format-validated.
- **Locate on page** — this is what actually closes the "which image?" gap: every finding that
  points at a real element is itself the control. Click it, and Sanity scrolls to and highlights
  that exact element on the live page — no more cross-referencing a log line's index numbers
  against the DOM by hand.
- **Block Structure** — reads `data-block-status`, the attribute `scripts/aem.js` sets on every
  block as it loads, to catch a block that rendered nothing before any visitor does.
- **Preview vs Live** — diffs this page against its counterpart on the other EDS environment.
- **Keeping it 100** — LCP payload budget, early third-party connections, and the
  preload/`fetchpriority` anti-pattern the docs call out as *counter-intuitive* (a generic tool
  would flag it as a win, not a problem).
- Plus the checks a generic tool does cover, but tuned to EDS's own conventions: performance,
  SEO, Open Graph/social previews, security headers, and accessibility (via axe-core).

Every finding renders flat and fully expanded — no accordion to open. The result is one place —
developers, content authors, SEO teams, and testers alike — go to run a quick sanity check on a
page and get a straight answer, instead of digging through publish logs or memorizing the limits
docs.

## 3. Solution

Sanity ships as a tiny entry point plus a UI chunk, and — because it's a developer/author tool,
not something a regular visitor should pay for — **none of it loads at all until a Sidekick user
actually clicks the Sanity button.** There's no top-level import anywhere in a consumer's
`scripts.js`; the only `import()` lives inside the `custom:sanity` event handler. Only at that
point does the entry point run (installing error capture, ~2.4KB) and immediately trigger a
second, separate fetch for the actual panel UI (Preact + axe-core, ~290KB gzip). A regular site
visitor who never opens Sidekick fetches zero Sanity-related bytes and never sees the floating
ball. It mounts into its own Shadow DOM once loaded, so nothing about the host page's styles can
leak in and nothing Sanity does can leak out.

### Install

```bash
npm i sanity.eds -D
```

This drops the built files into **`tools/sanity/`** in your own repo automatically via a
postinstall step — EDS serves pages from your site's own git repo, not from `node_modules`, so
the files have to live there to be loadable at all.

Wire it into `scripts.js` the same way [aem.live's sidekick-development
docs](https://www.aem.live/developer/sidekick-development) show for any event-type plugin:

```js
function initSanity() {
  const sidekick = document.querySelector('aem-sidekick');
  if (!sidekick) {
    document.addEventListener('sidekick-ready', initSanity, { once: true });
    return;
  }
  sidekick.addEventListener('custom:sanity', async (event) => {
    const { mount } = await import('/tools/sanity/index.js');
    mount(event.detail);
  });
}

initSanity();
```

Commit `tools/sanity/` — that's the only manual step in the whole flow. Updating later is just:

```bash
npm update sanity.eds
```

...which re-copies the newest build automatically.

**Full setup guide (including the Sidekick plugin manifest, CDN/vendoring alternatives, and
Content-Security-Policy requirements): see [SETUP.md](SETUP.md).**
