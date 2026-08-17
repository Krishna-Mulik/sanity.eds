<!-- title: Sanity -->

# Sanity

An AEM Sidekick plugin for Edge Delivery Services (EDS) sites: a self-contained UI that scans a
live EDS page for performance, SEO, social/OG, security, accessibility, and aem.live-limits
issues, and lets an author or developer jump straight to the offending element on the page.

```bash
npm i sanity.eds -D
```

**[→ Start with setup](#3-solution)**

## 1. Problem

EDS enforces hard <a href="https://www.aem.live/docs/limits" target="_blank" rel="noopener noreferrer">content/code-bus limits</a> — asset size caps
among them. Go over one and the symptom isn't a helpful error: content changes just silently stop
reflecting on `.live`. Nothing in the authoring UI tells you why. The only trail is the publish
logs, and even those aren't much help — a line like `image [12, 14, 16] svg over 40kb` tells you
*that* three SVGs are too big, not *which* three images on the page they actually are. Someone
then has to manually cross-reference index numbers against the page's DOM by hand, on every
occurrence, every time this happens. That's true of the whole
<a href="https://www.aem.live/developer/keeping-it-100" target="_blank" rel="noopener noreferrer">keeping-it-100</a> checklist too — LCP payload
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
- **Preview vs Live** — one-click-copy URLs for this page and its counterpart on the other EDS
  environment, plus a link to a real comparison tool. Not an auto-diff: `.aem.page`/`.aem.live`
  don't grant CORS to a browser-embedded `fetch()`, so this hands you the URLs instead of failing
  silently.
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
`/scripts/scripts.js`; the only `import()` lives inside the `custom:sanity` event handler. Only
at that point does the entry point run (installing error capture, ~2.4KB) and immediately trigger a
second, separate fetch for the actual panel UI (Preact + axe-core, ~290KB gzip). A regular site
visitor who never opens Sidekick fetches zero Sanity-related bytes and never sees the floating
ball. It mounts into its own Shadow DOM once loaded, so nothing about the host page's styles can
leak in and nothing Sanity does can leak out.

### 1. Install

```bash
npm i sanity.eds -D
```

This drops the built files into **`tools/sanity/`** in your own repo automatically via a
postinstall step — EDS serves pages from your site's own git repo, not from `node_modules`, so
the files have to live there to be loadable at all. Commit `tools/sanity/`.

### 2. Wire it into `scripts/scripts.js`

The same way <a href="https://www.aem.live/developer/sidekick-development" target="_blank" rel="noopener noreferrer">aem.live's sidekick-development docs</a> show for any event-type plugin. Add
this to `scripts/scripts.js` (not a new file — your project's existing one) — the relative path
(not `/tools/sanity/index.js`) matters if your project lints imports with
`eslint-plugin-import`, since `import/no-unresolved` can't resolve a root-absolute path back to
a file on disk:

```js
function initSanity() {
  const sidekick = document.querySelector('aem-sidekick');
  if (!sidekick) {
    document.addEventListener('sidekick-ready', initSanity, { once: true });
    return;
  }
  sidekick.addEventListener('custom:sanity', async (event) => {
    const { mount } = await import('../tools/sanity/index.js');
    mount(event.detail);
  });
}

initSanity();
```

### 3. Register the Sidekick plugin

Without this, no "Sanity" button ever appears in Sidekick, so step 2 never fires. This is pushed
through the Admin API, not committed as a file in your repo:

1. Go to <a href="https://tools.aem.live/tools/admin-edit/index.html" target="_blank" rel="noopener noreferrer">tools.aem.live/tools/admin-edit</a>.
2. In the URL field, paste your site's config endpoint:
   `https://admin.hlx.page/config/<org>/sites/<site>/sidekick.json`
   (substitute your own GitHub org and site name — e.g. `krishna-mulik`/`sanity`).
3. Set the **Body** to:
   ```json
   {
     "project": "Sanity",
     "plugins": [
       {
         "id": "sanity",
         "title": "Sanity",
         "event": "sanity",
         "environments": ["any"]
       }
     ]
   }
   ```
4. Set **Method** to `POST` and click **Save**.

`"environments": ["any"]` is a documented valid value; Sidekick itself already restricts
event-type plugins to dev/preview/live/prod regardless, so nothing further to configure there.

### 4. Content-Security-Policy (only if you run one)

Add `style-src 'unsafe-inline'` (or a matching nonce) and `font-src data:` — the panel injects a
runtime `<style>` tag and base64-embedded fonts. No `script-src` addition needed; everything
loads same-origin from `tools/sanity/`.

### Updating later

```bash
npm update sanity.eds
node node_modules/sanity.eds/scripts/postinstall.js
```

Run both, every time, as one step — not just the first one. This isn't a "just in case": npm's
own postinstall for `sanity.eds` isn't guaranteed to fire on every update (when npm decides
nothing in the dependency tree needs to change, it skips install scripts entirely, even if
`tools/sanity/` happens to be missing or stale for an unrelated reason), so the second command
is what actually guarantees `tools/sanity/` reflects what just got installed. It's cheap and
side-effect-free to run unconditionally — it only ever copies 3 files, nothing else. Commit the
resulting diff.
