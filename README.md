<!-- title: Sanity -->

# Sanity

An AEM Sidekick plugin for Edge Delivery Services (EDS) sites: a self-contained UI that scans a
live EDS page for performance, SEO, social/OG, security, accessibility, and aem.live-limits
issues, and lets an author or developer jump straight to the offending element on the page.

## 1. Problem

Generic auditing tools — Lighthouse, SEO browser extensions, accessibility scanners — run
separately from the authoring tool and have no concept of EDS at all. None of them know what an
EDS "block" is, so a block whose `decorate()` silently threw and rendered nothing is invisible to
all of them: no error, no failed check, just missing content nobody notices. None of them check
against EDS-specific limits either — content/code-bus size caps, redirect counts, sitemap size,
`.aem.page`/`.aem.live` preview-vs-live drift, the LCP-payload and preload guidance from
[aem.live/developer/keeping-it-100](https://www.aem.live/developer/keeping-it-100) — because
those constraints don't exist outside EDS. Authors and developers are left either shipping blind
or manually working through the [aem.live/docs/limits](https://www.aem.live/docs/limits) checklist
by hand, on every page, on every change.

## 2. Fix

Sanity runs inside the same Sidekick surface authors and developers already use — not a separate
dashboard — and checks the live page against real EDS/aem.live rules a generic tool has no way
to know about:

- **Block Structure** — reads `data-block-status`, the attribute `scripts/aem.js` sets on every
  block as it loads, to catch a block that rendered nothing before any visitor does.
- **Preview vs Live** — diffs this page against its counterpart on the other EDS environment.
- **aem.live limits** — content/code-bus sizes, sitemap/redirect counts, robots.txt, JSON-sheet
  payload caps, all measured against the documented thresholds, not just format-validated.
- **Keeping it 100** — LCP payload budget, early third-party connections, and the
  preload/`fetchpriority` anti-pattern the docs call out as *counter-intuitive* (a generic tool
  would flag it as a win, not a problem).
- Plus the checks a generic tool does cover, but tuned to EDS's own conventions: performance,
  SEO, Open Graph/social previews, security headers, and accessibility (via axe-core).

Every finding renders flat and fully expanded — no accordion to open — and any finding pointing
at a real page element is itself the control that scrolls to and highlights it live.

## 3. Solution

Sanity ships as a single self-contained JS file. It has no CSS to link and no assets to copy —
fonts are base64-inlined and it mounts itself into its own Shadow DOM (so nothing about the host
page's styles can leak in, and nothing Sanity does can leak out) the moment it's loaded.
Importing the file *is* the init call.

### Install

```bash
npm i sanity.eds -D
```

This drops the bundle into **`tools/sanity/index.js`** in your own repo automatically via a
postinstall step — EDS serves pages from your site's own git repo, not from `node_modules`, so
the file has to live there to be loadable at all.

Add one line to your `scripts.js` (or wherever else runs on every page):

```js
import '/tools/sanity/index.js';
```

Commit `tools/sanity/index.js` — that's the only manual step in the whole flow. Updating later is
just:

```bash
npm update sanity.eds
```

...which re-copies the newest build automatically.

**Full setup guide, CDN/vendoring alternatives, update flow, and Content-Security-Policy
requirements: see [SETUP.md](SETUP.md).**
