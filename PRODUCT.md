# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Preact + TypeScript. Corrected architecture: the Sidekick "Sanity" button is an **event-based plugin** — clicking it only dispatches a `custom:` event; it does not open a palette/popover/iframe. The target EDS site's own `scripts.js` listens for that event and mounts the Preact app **directly into the live page's DOM**. Chosen over React (lighter runtime, matters more now since it ships as part of the host site's own JS payload) and vanilla Web Components (real component/hook ergonomics needed for tabs, live scan progress, and score gauges).

## Users

- **Content authors / marketers** — use SEO-facing checks: spell checker, alt-text validation, Open Graph tags, and social card visual previews across platforms (Facebook, X, LinkedIn, WhatsApp, Discord, etc.).
- **Developers** — use technical checks: EDS-specific tests (404/broken pages), aem.live limits compliance, security checks, and performance/page-speed.

Both work inside AEM Sidekick while authoring, previewing, or publishing EDS pages — Sanity meets them in that toolbar rather than a separate dashboard.

## Product Purpose

Sanity is an AEM Sidekick plugin that runs automated sanity/validation checks on Edge Delivery Services (EDS) pages and sites directly from the authoring/preview toolbar — surfacing performance, SEO, security, and EDS-limits issues without leaving the Sidekick workflow. Basic automated checks (page speed, SEO, security) ship first; deeper validation against the full [aem.live/docs/limits](https://www.aem.live/docs/limits) toolkit is a later phase.

## Positioning

Unlike general auditing tools (Lighthouse, generic SEO browser extensions) that run separately from the authoring tool and have no notion of EDS-specific constraints, Sanity runs inside the same Sidekick surface authors and developers already use, and checks against EDS/Franklin-specific rules (content/code bus limits, redirect counts, sitemap size, admin API limits, etc.) that generic tools don't know about.

## Operating Context

Used inside the AEM Sidekick Chrome extension while working an EDS site across dev/preview/live/prod environments. The plugin is organized into seven sections, each its own page in the UI, reachable from a persistent floating launcher docked to the page edge. SEO, Social, and Technical are further split into tabs within their own page as their content has grown, rather than staying one long scroll:

- **Summary** — overall critical/warning count plus a row per section.
- **Speed** — score, Core Web Vitals against their thresholds, render-blocking resources, ranked recommendations, plus EDS-specific "Keeping it 100" checks (LCP payload budget, early third-party connections, preload/fetchpriority anti-patterns).
- **SEO** — tabbed: Findings (canonical, title/description, spelling, structured data, favicon), Metadata, Structure, Links, and Preview vs Live (copy-to-clipboard URLs for this page and its counterpart on the other EDS environment, plus a link to a real third-party comparison tool — not an auto-diff, since `.aem.page`/`.aem.live` don't grant CORS to a browser-embedded fetch).
- **Social** — a meta-tag inspector (every Open Graph/Twitter Card tag checked individually, including og:image's real dimensions and aspect ratio), plus a platform-accurate preview per platform (Facebook, X, LinkedIn, WhatsApp, Discord) showing how the page will actually render when shared. Its own top-level section, not nested under SEO.
- **Security** — CSP, mixed content, framing and referrer headers, analytics/martech detection.
- **Technical** — tabbed: Limits (aem.live limits compliance, reported as measured value against the allowed cap) and Block Structure (EDS `data-block-status` health — the one check no generic tool can do, since none of them have a concept of an EDS "block"). Named "Technical," not "Limits," because Block Structure isn't a cap-compliance check — it's "does the EDS pipeline actually work," a different kind of question that happened to get bundled into the same section early on.
- **Accessibility** — axe-core violations, plus the one gap it doesn't cover (multiple H1s).

Findings render flat and fully expanded, never behind an accordion: the point of the panel is to read everything wrong with the page in one pass. Any finding that points at a real asset or element shows its path, and the path itself is the control that scrolls to and highlights that element on the live page.

General-purpose tool: intended to be installable by any AEM/EDS site, not scoped to one organization's repos, so checks must stay generic to arbitrary EDS/Franklin site structures rather than hardcoding one team's conventions.

## Capabilities and Constraints

- Registers with Sidekick via its JSON plugin manifest (`id`/`title`/`environments`, etc.) as an **event-based plugin**; does not modify the `aem-sidekick` extension itself.
- The Sidekick button only dispatches a `custom:` event on click — it carries no UI of its own. **No iframe, no palette, no popover.**
- The actual Sanity UI ships as part of the target EDS site's own `scripts.js`, which listens for that event and mounts the Preact app directly into the live page's DOM.
- Because the UI shares the host page's real DOM and global CSS (no iframe boundary), it **must mount inside a Shadow DOM root** to avoid the host site's CSS bleeding in and vice versa.
- Event-based plugins only fire in Development, Preview, Live, and Production environments — not Edit or Admin — per Sidekick's plugin model.
- Distribution, since this must work on any EDS site (general-purpose): the target site's `scripts.js` needs to import/load the Sanity code (e.g. dynamic import from a hosted script) plus a Sidekick plugin manifest entry — both are integration steps every adopting site performs, not a one-time deploy by us.
- Phase 1 (current scope): page speed, SEO, security basic checks.
- Phase 2 (later, undecided detail): full [aem.live/docs/limits](https://www.aem.live/docs/limits) validation and broader EDS sanity toolkit.
- **Open/undecided:** exact distribution mechanism for `scripts.js` to pull in Sanity's code (hosted CDN script vs. npm package vs. copy-in snippet).
- **Open/undecided:** whether checks run per-page, per-site (crawl), or both.

## Brand Commitments

Name is "Sanity." No existing logo or visual assets yet.

## Evidence on Hand

None yet — no existing content, screenshots, or reference site data provided. Future work must not fabricate example scan results, testimonials, or specific site data.

## Product Principles

1. Live inside the authoring workflow — checks run where authors and developers already work (Sidekick), not a separate dashboard.
2. Understand EDS specifically — validate against real aem.live/EDS constraints and limits, not generic web-audit heuristics alone.
3. Match depth to role — authors get actionable, plain-language signals (SEO/content checks); developers get full technical detail (dev/security/limits checks).
4. General-purpose by default — no hardcoded assumptions about one team's repo or hosting conventions, since this is meant for any EDS site.
5. Basic automation first, deep toolkit later — ship page speed/SEO/security checks now; aem.live limits and the fuller sanity toolkit are a deliberate phase 2.
