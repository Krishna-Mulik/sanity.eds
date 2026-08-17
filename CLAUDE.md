# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Sanity** is an AEM Sidekick plugin for Edge Delivery Services (EDS) sites: a self-contained
UI that scans a live EDS page for performance, SEO, social/OG, security, and aem.live-limits
issues, and lets an author or developer jump straight to the offending element on the page.

This repo is currently the **standalone UI build** — a Preact app you run and click through
via `pnpm dev`. It is not yet wired into a real Sidekick install or a real EDS `scripts.js`;
`index.html` simulates both (see "Dev harness" below). `PRODUCT.md` and `DESIGN.md` are the
source of truth for product intent and the visual system, respectively — read them before
making product or design decisions, not just this file.

## Commands

```
pnpm install              # install deps (pnpm, not npm — pnpm-lock.yaml is committed)
pnpm dev                  # vite dev server at http://localhost:5173
pnpm build                # tsc -b && vite build
pnpm preview              # serve the production build
pnpm exec tsc -b --noEmit # typecheck only, no build output
pnpm test                 # vitest run — unit tests for the scan/check logic
pnpm test:watch           # vitest, watch mode
```

There is no lint config (no eslint) — `tsc` and `vitest` are the automated checks. Every
`src/lib/scan/*.ts` module is split into an impure `gatherX()` (talks to `document`/`fetch`/
`PerformanceObserver`, not unit tested) and a pure `evaluateX(rawData)` (takes plain data,
returns `Finding[]`; unit tested in the sibling `*.test.ts`). Follow that split for new checks.
Visual/rendering behavior still has no DOM-assertion coverage — verify it as below.

### Visual verification

The panel is a floating UI injected via Shadow DOM, so screenshots are the only reliable way
to review a change — DOM assertions have repeatedly missed real rendering bugs here (stretched
icons, invisible bubbles, off-screen labels) that were obvious the moment a screenshot was
taken.

```
pnpm dev                        # in one terminal
node tools/shoot.mjs [outDir]   # in another; defaults to ./shots
```

`tools/shoot.mjs` drives the panel through every section, at both a desktop (1440×900) and a
mobile (390×844) viewport, and writes numbered PNGs. It expects the dev server at
`http://localhost:5173` (override with `SANITY_URL`). Read the PNGs after generating them —
generating without looking at them defeats the point.

## Architecture

### Mounting: no iframe, no palette — and lazy, not eager

The entire premise is that this ships as part of a **target EDS site's own `scripts.js`**,
not as a Sidekick iframe/popover. A Sidekick "Sanity" button dispatches a `custom:sanity`
`CustomEvent` **on the `<aem-sidekick>` element itself** — not `document`, not `window`, per
[aem.live's sidekick-development
docs](https://www.aem.live/developer/sidekick-development) — which is what `App.tsx`'s own
internal listener targets (with the documented `sidekick-ready` fallback for the case Sidekick
hasn't initialized yet).

The distributable (`src/plugin-entry.ts`, built by `vite.plugin.config.ts` into `dist-plugin/`)
is deliberately split into two chunks, not one eagerly-mounted bundle — `sanity.js` +
`sanity-core.js` (~2.4KB, `installRuntimeErrorCapture()`, zero Preact/axe-core dependency) vs.
`sanity-ui.js` (~290KB gzip, the actual panel: Preact + axe-core + every scan module). But per
README.md's documented consumer wiring, **nothing imports the entry point at all until a Sidekick
user actually clicks the Sanity button** — the only `import('../tools/sanity/index.js')` a
consumer's `scripts.js` ever does lives inside the `custom:sanity` event handler (relative, not
`/tools/sanity/index.js` — a root-absolute path trips `eslint-plugin-import`'s
`import/no-unresolved` in projects that lint imports, e.g. aem-boilerplate's default config).
This is
intentional: Sanity is a developer/author tool, so a regular site visitor should fetch *zero*
Sanity-related bytes, not even the cheap 2.4KB tier, until that event actually fires. The
trade-off is real and worth stating plainly rather than glossing over: runtime-error capture
only sees errors from that first click onward, never from page load — there is no way to see
console/script/resource errors that fired before someone opened Sidekick and clicked Sanity, on
top of the existing limitation of not seeing errors that fired before Sanity was on the page at
all.

Once the click happens, `mount(event.detail)` is what actually triggers the *second*, separate
dynamic `import()` for `sanity-ui.js` — this is the point that installs error capture (now that
the entry point has finally loaded) and, right after, fetches and mounts the panel UI. `mount()`
is idempotent and passes `autoOpen: true` into `<App>` on first mount, so the panel opens on
that very first click rather than needing a second one (the click that triggered the lazy load
is long gone by the time `App`'s own listener would otherwise catch it).

This replaced an earlier eager-mount design (`initSanity()` running unconditionally as an
import side effect) that shipped the full ~290KB bundle, and a visible ball, to every visitor —
including anonymous end users with no Sidekick at all.

`plugin-entry.ts` also exports `mountOnLoad()` — an **opt-in** second entry point, not called by
anything else in the file, that a consumer can call directly to mount Sanity without the
`custom:sanity` event at all. It exists because Sidekick gates its *entire* toolbar (this
plugin's button included) behind the Admin API recognizing the logged-in identity as an
authorized collaborator on the site — so an unauthorized teammate, or a demo/showcase site's own
visitors, never see Sanity even with the event-based wiring correct (this surfaced from a real
showcase site where a second, non-collaborator account got Sidekick's own "Account not
authorized for this site" and no Sanity icon). `mountOnLoad()` deliberately reverses the
zero-bytes-to-anonymous-visitors guarantee `mount()` provides — every visitor downloads the full
UI chunk, not just Sidekick users — so it's documented as a demo-project-only escape hatch in
README.md, never the default. It waits on `waitForLoadAndLcp()` (page `load` event AND the
page's first LCP `PerformanceObserver` entry, both required, with a 10s ceiling so a page with no
qualifying LCP candidate can't hang it forever) before mounting with `autoOpen: false` — unlike
`mount()`'s `autoOpen: true`, there's no click to "catch up to" here, and forcing the full panel
open for every visitor with no interaction would be its own bad UX on top of the bytes trade-off.

Once mounted, the panel creates its own `<div id="sanity-panel-host">` with
`attachShadow({ mode: 'open' })`. All component CSS (`src/lib/tokens.css.ts` +
`src/lib/panel.css.ts`) is concatenated into one `<style>` and injected into that shadow root.
Nothing the panel does can leak style into the host page, and nothing the host page does can
reach in — this is load-bearing, since the panel must render correctly over an arbitrary,
unknown site.

The one place style *does* have to cross that boundary: highlighting a target element for
"locate on page" happens in the **light DOM** (`src/lib/locate.ts`), so severity colors are
duplicated as hex literals in `src/lib/severity.ts` rather than referenced as CSS custom
properties, which wouldn't be visible outside the shadow root.

### Dev harness

`index.html` is not the product — it's a fake EDS page ("Cairn Supply Co.") standing in for
the real host site, with `data-sanity-target="..."` attributes marking a few elements (hero
image, subcopy, etc.) so their real findings get a clean, stable selector instead of a
generated nth-of-type chain. `pnpm dev` boots this harness via `src/main.tsx`, which calls
`initSanity()` eagerly and unconditionally — appropriate for a dev harness that always wants
the panel visible, but not what ships to real consumers; see "Mounting" above for the real,
lazy `mount()`-on-click distributable built from `src/plugin-entry.ts` instead.

### UI shell: ball → honeycomb cluster → phone panel

`src/components/App.tsx` is a small state machine (`Phase = 'scanning' | 'idle' | 'fan' |
'panel'`) coordinating two components:

- **`SanityLauncher.tsx`** — the floating ball. Draggable (real spring physics, not CSS
  transitions — see below), shows overall severity and a critical/warning badge at rest.
  Hovering or tapping it (`phase: 'fan'`) pops the section bubbles (seven today) into a
  **honeycomb cluster**, not an arc — the geometry is in `src/lib/geometry.ts::clusterLayout`,
  which hex-packs `columnSizes(count, maxPerColumn)` columns next to the ball (balanced, extra
  items biased to the inner column — 6 → [3,3], 7 → [3,2,2] — never a lonely single-bubble
  column) and shifts the whole cluster vertically if the ball is near a viewport edge. This is
  count-agnostic by design; adding/removing a section does not need packing changes. Read the
  comment above `clusterLayout` before changing the packing math; an arc was tried and rejected
  (documented in `DESIGN.md`) because bubbles need to spread too far from the ball on an arc to
  avoid touching.
- **`PhonePanel.tsx`** — the phone-shaped panel a bubble opens into (`phase: 'panel'`).
  Header (title + severity breakdown + close), a scrollable `.sk-screen`, and a tab bar
  (`grid-template-columns: repeat(auto-fit, minmax(0, 1fr))`, so it also doesn't need updating
  per-section) for switching sections without closing the panel. Placement
  (`geometry.ts::panelPlacement`) grows the panel out of the ball's screen position and
  switches to a bottom sheet under 620px viewport width.

`src/lib/spring.ts` implements a real spring integrator (damping ratio + response, in Apple's
"Designing Fluid Interfaces" style) with momentum projection and rubber-banding, used for the
ball's drag. This is deliberate, not incidental — gesture-driven motion here uses the spring,
never a CSS transition, so a drag can be interrupted and re-targeted without a visible jump.
Non-gesture transitions (the cluster popping out, the panel appearing) use CSS with an
exponential-decelerate easing; bounce/elastic easing is intentionally avoided everywhere
(flagged by the design-slop detector if reintroduced — see `DESIGN.md`).

### Sections and data — real scanning, not sample data

Scanning is real. `src/lib/scan/` has one module per check domain (`limits.ts`, `siteLimits.ts`,
`security.ts`, `seo.ts`, `structuredData.ts`, `social.ts`, `links.ts`, `favicon.ts`,
`performance.ts`, `runtimeErrors.ts`, `accessibility.ts`, `blockStructure.ts`, `consistency.ts`),
each following the `gatherX()` (impure) / `evaluateX()` (pure, tested) split described under
Commands above.

**Preview vs Live content comparison went through two designs before landing on the current one
— a copy-and-link-out, not an auto-diff.** The first version's `consistency.ts` fetched this
page's counterpart on the other EDS environment (`.aem.page` ⟷ `.aem.live`) directly and diffed
title/description/visible-text blocks, following the same fetch-with-honest-fallback pattern as
every other cross-origin check (og:image, JSON sheets, canonical, favicon). It was removed after
confirming, against a real deployed site, that it almost never works: `.aem.live`/`.aem.page` send
no `Access-Control-Allow-Origin` header by default, so the cross-origin `fetch()` fails out of the
box for essentially every real site (`curl`/server-side HTTP has no such restriction and diffed
the two pages fine, including a genuine `<h1>`→`<h2>` drift on that page — proving the *content*
comparison itself is valuable, just not reachable from a browser-embedded `fetch()`, which is
exactly what CORS restricts). Fixing that properly needs the *site owner* to add a `headers.json`
CORS rule ([aem.live/docs/custom-headers](https://www.aem.live/docs/custom-headers)) — not
something Sanity controls or most sites will ever configure — so rather than leave a check that
reads "Not checked" for nearly everyone, or stand up a proxy service (the only real architectural
fix, and a materially bigger project than "a client-side script with zero infrastructure"),
`consistency.ts` now does neither: `computeConsistencyUrls()` is a pure hostname swap (no fetch,
so no CORS to hit) producing this page's URL and its counterpart's, and the "Preview vs Live" tab
just hands the author both as one-click-copy rows plus a link to a separate comparison tool
([content-compare](https://imswapnilgaikwad.github.io/content-compare/), current choice, per
product decision) to paste them into. None of the three tools evaluated (that one, Thruuu, DiffNow)
support pre-filling their compare form via URL — confirmed by testing all three directly:
submitting doesn't produce a shareable/query-string URL, and pre-loading with guessed param names
doesn't populate their fields either — so this is deliberately copy-paste, not a fake "one-click"
promise the tools don't actually support. Worth flagging plainly: content-compare was also verified
to issue **zero network requests** to either input URL on submit (checked against two different
URL pairs, including two totally unrelated real sites), while still confidently rendering a parity
score — its output isn't derived from either page's real content, unlike Thruuu/DiffNow (both
confirmed to do a genuine server-side fetch — Thruuu independently caught the same real `<h1>`→`<h2>`
drift a direct `curl` diff found). Linked anyway per product decision; if revisited, Thruuu is the
one of the three that's actually verified to work.
`favicon.ts` checks the `<link rel="icon">` in `<head>` actually resolves, not just that the tag
exists — folded into SEO findings (not Security/Technical) since that's where an author looks for
`<head>` link checks alongside canonical/viewport. It's probed with an `Image()` load (same
technique and same reason as the `og:image` probe in `social.ts`: a `fetch()` would
false-negative on a valid cross-origin favicon a browser loads without CORS). A web-app-manifest
check was deliberately left out: `manifest.json` is optional PWA/installability metadata, not
something aem.live requires or that most content-driven EDS sites (marketing pages, blogs, docs)
use — a missing one isn't a real problem worth flagging. `src/lib/scan/index.ts::runScan()` is
the orchestrator —
it fans out the gathers (network-bound ones run in parallel via `Promise.all`, each internally
timeout-bounded) and assembles a `ScanResult` (`src/data/types.ts`), including the per-section
severity/count rollups. `src/lib/scanContext.ts` owns the scan lifecycle (`useScanState`, called
once from `App.tsx`) and exposes it via `ScanContext`/`useScan()` to every consumer — nothing
below `App` imports scan data directly. `src/lib/mount.tsx` installs runtime error capture
(`scan/runtimeErrors.ts`) *before* the scan runs, since there's no way to see console/script
errors that fired before Sanity mounted.

Not everything is checkable from an in-page script — GitHub/Admin API/BYOM/sitemap limits need
repo or Admin API access this plugin doesn't have, and cookie `Secure`/`HttpOnly`/`SameSite`
flags are invisible to page JS by browser design. Those show up as an explicit `severity: 'idle'`
("Not checked") finding rather than being silently skipped or faked — keep that pattern for any
new check that hits a similar wall. This also applies to the aem.live *asset size* limits
(`limits.ts`): they only apply to same-origin content-bus assets, so a cross-origin image is
silently excluded from the size scan rather than measured as 0 bytes and passed — that avoids a
real bug (Resource Timing zeroes `encodedBodySize`/`transferSize` for cross-origin resources
without `Timing-Allow-Origin`) that used to make the whole section look inert. An earlier version
surfaced this as its own "N assets hosted on another origin" idle note, but it added noise
without being actionable — cross-origin exclusion is just documented here and in code comments
now, not surfaced as a finding. Same-origin asset sizing prefers a live HEAD fetch's
`Content-Length` over Resource Timing for reliability. `limits.ts` also discovers same-origin
`.json` beyond the three conventional sheets (more on those below) — see `json` `LimitAssetKind`.

`siteLimits.ts` covers the rest of the published limits page that isn't about *this* page: it
parses `ref--repo--owner` straight off the `.aem.page`/`.aem.live` hostname (no API needed) for
the 63-char/naming checks and to show the site identity in Summary, and fetches `/sitemap.xml`
and `/redirects.json` same-origin for the sitemap/redirect-count limits. It also fetches the
three conventional top-level content-source JSON sheets — `/query-index.json`, `/metadata.json`,
`/placeholders.json` — same-origin, checking each against the 6MB compressed response-payload cap
(reusing `PAYLOAD_MAX` exported from `limits.ts`, since it's the same limit on a different
resource) and, for the query index specifically, its row count against the 50,000-page index
capacity from [aem.live/docs/large-sites](https://www.aem.live/docs/large-sites). A page/query-
index count nearing the docs' *recommended* (not hard) 1M-page ceiling is a separate warning-level
note in `evaluateSiteLimits()`, since that page also documents graduated advice (single
index/sitemap/metadata sheet up to ~50k pages, split into multiple indexes from 50k–1M, consider
multiple repoless sites approaching 1M) rather than one cliff. The three sheets themselves,
though, are **not** Findings — `evaluateJsonSheetMetrics()` returns `Metric[]` instead (same
shape `evaluateCwv()` uses for the CWV grid: `{id,label,value,target,severity}`), rendered as
always-visible cards in the Technical → Limits tab's "JSON sheets" block (`value: 'Not found'`
and `severity: 'idle'` when a sheet is absent, `formatBytes(...)` and a normal/warning/critical
severity when present). An earlier version instead emitted a Finding per sheet (critical/warning
when over cap, idle "not found" otherwise) plus one long prose "here's what we check and why"
idle note — three silent passes next to a wall of text read as clutter, and Findings that never
have a `targetSelector` (a JSON sheet isn't a DOM element) get little value from the Finding
list's click-to-locate affordance anyway, so a metrics grid is a better fit than a Finding for
this specific case. `limits.ts` separately discovers same-origin `.json` beyond these three
conventional sheets — any `.json` this page links to (`a[href$=".json"]`) or actually fetched
during load (via Resource Timing) gets the same generic asset-size *Finding* treatment as
images/SVGs/videos (checked against the 6MB payload cap under a new `json` `LimitAssetKind`),
explicitly excluding the three conventional sheet paths so the same file never gets both a card
and a Finding. This is the only honest way to check "any JSON file" from a single page scan —
there's no way to enumerate JSON a page never references. Every remaining category from the docs
(GitHub Code Sync file/size-per-ref, Admin API rate limits, BYOM) gets its own explicitly labeled
"not checkable, and why" note — never one blanket disclaimer.

`siteLimits.ts` also covers two items from
[aem.live/docs/go-live-checklist](https://www.aem.live/docs/go-live-checklist) that nothing
previously checked: it fetches `/robots.txt` (same false-positive guard as the sitemap/JSON-sheet
fetches — a 200 with no real `User-agent` directive isn't a real robots.txt) and parses it with
the pure, unit-tested `parseRobotsTxt()` for a `Sitemap:` directive and a blanket
`Disallow: /` under `User-agent: *`; and it requests a deliberately random, guaranteed-nonexistent
path to confirm the site actually responds `404` rather than silently `200` (a dev server's SPA
fallback is a real, correctly-flagged example of this — proven live against `pnpm dev`, which has
no server-level 404 handling). When the status isn't 404, `gatherNotFoundCheck()` also reads the
response's `<title>`/`<h1>` against a small "not found" phrase list to tell apart two different
failures that share the same wrong status code: a real dedicated error page just served with the
wrong status (a config fix), versus no error page at all — the homepage or a bare SPA fallback
serving identical content for every unmatched path (a bigger gap). Each gets its own finding
title/detail rather than one generic "not 404" message for both.

`seo.ts::checkCanonicalStatus()` fetches the canonical URL itself (same-origin only) to confirm it
resolves with a direct 2xx — the go-live checklist calls out a canonical that redirects or errors
as a real problem, and until now the canonical check only validated the tag's *format*, never
whether the URL behind it actually works. `Response.redirected` (not `redirect: 'manual'`, which
forces an opaque, unreadable response for any origin) is what detects the redirect case. A
cross-origin canonical gets an idle "can't verify" note rather than a guess, same pattern as the
favicon/JSON-sheet cross-origin limitations elsewhere.

`security.ts` also detects analytics/martech instrumentation (`ANALYTICS_VENDOR_PATTERNS`, a
small curated list in the same spirit as `seo.ts`'s misspelling map — real signal, not exhaustive)
by matching known vendor script hosts (GA4, GTM, Adobe Launch/Analytics, Segment, Meta Pixel,
HubSpot, etc.) already present in `thirdPartyScriptOrigins`'s script scan. This can only confirm
*presence*, never that data is actually reaching a dashboard — the go-live checklist's real ask —
so the finding's detail is explicit about that gap rather than overclaiming.

`blockStructure.ts::gatherEdsRuntimeDetected()` checks for `window.hlx` or a
`scripts/aem.js`/`scripts/scripts.js` `<script>` tag. It only changes the "no block markers found"
finding's severity (from `idle` to `warning`, when the runtime genuinely isn't detected) — if any
`data-block-status` elements exist at all, that's already strong direct evidence the pipeline ran,
so the runtime-detection heuristic is deliberately not consulted in that branch, avoiding a weak
heuristic overriding a strong direct signal.

`performance.ts` also encodes three numbers/rules from
[aem.live/developer/keeping-it-100](https://www.aem.live/developer/keeping-it-100) that are
EDS-specific enough that a generic Lighthouse/PSI score doesn't expose them as named rules (most
of that doc — build tooling, minification policy, CI gating — is developer-workflow guidance with
no runtime artifact a page scan can observe): `evaluateLcpPayloadBudget()` sums Resource Timing
`transferSize` for everything that arrived (`responseEnd`) before the measured LCP timestamp and
flags it over the ~100KB budget the doc calls out for a sub-1.5s mobile LCP;
`evaluateEarlyThirdPartyConnections()` flags any cross-origin resource whose `startTime` is before
LCP (a DNS+TLS handshake competing with the LCP candidate for the same early bandwidth); and
`evaluatePreloadHints()` flags any `<link rel="preload">` or `fetchpriority="high"` at all,
regardless of timing — the doc's guidance here is *counter-intuitive* (both usually read as
performance wins to a generic tool, but aem.live's own testing found they hurt LCP in this
architecture), which is exactly the kind of check a generic auditor would get backwards rather
than simply miss. Implementing these surfaced a real bug: `buildRecommendations()` was telling
users to "Preload... the largest above-the-fold image... driving LCP" — directly contradicting
this guidance — fixed alongside adding the new checks.

Building these also surfaced that `performanceFindings` (large-bundle, duplicate-request, and
runtime-error findings, now joined by the three above) was computed for section severity/badge
tallying but never actually returned in `ScanResult` or rendered anywhere — the Performance
section only ever showed the CWV grid, render-blockers, and a generic recommendations list, so
these findings silently affected the badge color/count without the user ever seeing what they
were. Fixed by adding `performanceFindings` to `ScanResult` and a `Findings` block (`Block` +
`FindingRow` + `SeverityCounts`, same vocabulary as every other section) to `PerformanceSection`.

[aem.live/docs/testing](https://www.aem.live/docs/testing) is almost entirely load/performance/
penetration-testing *methodology* (which tools to run, what traffic volume to simulate, who to
disclose vulnerabilities to) — none of it is a runtime fact a single page scan can observe, same
as `dev-collab-and-good-practices`. One line was directly actionable though: the doc groups
`.aem.page` *and* `.aem.live` together as "preview/delivery tiers," explicitly distinct from the
production CDN a real visitor hits, and says field RUM data is the authoritative performance
source — not synthetic lab measurements. `performance.ts::evaluateMeasurementScope()` surfaces
that caveat (previously only a code comment, never shown to the user) whenever `refInfo.matched`
is true, regardless of which of the two hosts it is, since the doc doesn't treat `.aem.live` as
more "production" than `.aem.page` for this purpose. `PerformanceSection` also gained a
PageSpeed Insights / WebPageTest link-out (`.sk-linkrow` + `.sk-docs`, same pattern as SEO's
robots.txt/sitemap.xml links) pre-filled with the current page's URL — the doc names both as the
right tools for this, closing a link-out that was planned from the very first pass of this
project ("explicitly out of scope... better served as an 'open in new tab' link-out") but never
actually built. The doc's one numeric threshold (200 uncached req/s triggers rate-limiting) was
deliberately *not* built into anything: verifying it would mean Sanity actively sending a flood
of requests at the site it's embedded in, which is a load test, not a passive scan — inappropriate
for an always-on floating widget to do on its own.

**`blockStructure.ts` is the plugin's actual differentiator, not a generic check.** It reads
`data-block-status`, which `scripts/aem.js` sets on every EDS block as its loader processes it
(`"loading"` → `"loaded"`, or left on `"loading"`/set to `"error"` if `decorate()` threw). A
block that silently renders nothing is invisible to Lighthouse, axe, or any generic SEO/security
scanner — none of them have a concept of an EDS "block" at all. This is folded into the Technical
section (`src/components/sections/index.tsx::TechnicalSection`) as its own "Block Structure" tab,
alongside "Limits" — the two were originally both blocks stacked inside a section called "Limits,"
but Block Structure and the old Preview-vs-Live check aren't actually limit-compliance checks
(measured value against a documented cap); they're "does the EDS pipeline/delivery configuration
work" questions, a different kind of check. Renamed the section to "Technical" (scoped to that
question) and gave it a `Limits`/`Block Structure` tab split — the `SectionId` literal is
`'technical'`, not `'limits'`, throughout `data/types.ts`, `data/sections.tsx`,
`lib/scan/index.ts`, and `PhonePanel.tsx`. The dev harness (`index.html`) simulates the real
block-status lifecycle with a healthy `cards` block and a deliberately broken `reviews` block
(`data-block-status="error"`) so this has something real to prove itself against; a real EDS site
sets these attributes itself once `aem.js` runs.

`maxCells.ts` reimplements [eslint-plugin-xwalk](https://github.com/adobe-rnd/eslint-plugin-xwalk)'s
`xwalk/max-cells` rule — a build-time ESLint rule (not a JSON schema field) that lints a
Universal-Editor/document-based-authoring ("xwalk") project's `component-models.json` to catch a
block whose authoring model has too many editable fields, since a Word/Google Docs table gets
unwieldy past a handful of columns. Its counting logic (field collapsing on
Text/Title/Type/Alt/MimeType suffixes, then underscore-prefix grouping — `imageAlt` collapses into
`image`, `cta_text`/`cta_link` collapse into one `cta` group) was reimplemented line-for-line and
verified against the real rule's own test fixtures (`tests/rules/max-cells/` in that repo — same
model shapes, same expected cell counts for every case, copied verbatim into `maxCells.test.ts`).
`gatherComponentModels()` fetches `/component-models.json` and `/component-definition.json`
same-origin — the same two files a real xwalk site publishes at its root (confirmed against the
[adobe-rnd/aem-boilerplate-xwalk](https://github.com/adobe-rnd/aem-boilerplate-xwalk) reference
repo) — with the usual honest-fallback pattern: a site that doesn't use xwalk (plain Word/
Google-Docs authoring, still the common case) simply doesn't have these files, so
`evaluateMaxCells()` quietly returns no findings rather than a permanent "not applicable" note on
every non-xwalk site. One thing this can't replicate: a project's real ESLint config can override
the default limit per block (this project's own `.eslintrc` sets `section: 30`, for instance) —
that's a dev-only build file never shipped to the live page, so every block here is checked
against the rule's own documented default of 4 cells, and each finding says so explicitly rather
than implying it knows the site's real configured threshold. Findings are `copyable` (pointing at
`/component-models.json`) rather than locatable, same reasoning as the JSON size-limit findings in
`limits.ts` — a model definition has no DOM element to scroll to. Rendered in the Technical section's
existing "Block Structure" tab, in its own "Block field limits" block alongside the
`data-block-status` findings — both are "does this EDS project's authoring/delivery configuration
hold up" questions, just at different layers (runtime block health vs. authoring-model shape).

`src/data/sections.tsx` exports `buildSectionDefs(result: ScanResult | null): SectionDef[]` —
add a new section's registry entry here (id, label, icon, severity/count derivation). It's a
function, not a static array, because it derives from the live scan result each render (`null`
while the first scan is in flight). `src/data/types.ts` defines the shared `Finding`/`Metric`/
`ScanResult`/etc. shapes.

`src/components/sections/index.tsx` has one component per section (`SummarySection`,
`PerformanceSection`, `SeoSection`, `SocialSection`, `SecuritySection`, `TechnicalSection`,
`AccessibilitySection`), each starting with `const { result } = useScan()` and a `<Loading />`
fallback for the rare case a section renders before its scan resolves (e.g. the Sidekick
`custom:sanity` event firing mid-scan). They compose entirely from the small shared vocabulary
in `src/components/blocks.tsx` (`Block`, `FindingRow`, `MetricCell`, `AllClear`, `Loading`) —
**do not build a bespoke card/row shape inside a section**; extend `blocks.tsx` instead if
something new is needed. `FindingRow` always renders fully expanded (no accordion) by product
decision — see `PRODUCT.md`. A `Finding.targetSelector` for a real DOM element is built by
`src/lib/selector.ts::buildSelector()` (prefers `data-sanity-target`/`id`, else an nth-of-type
chain unique in the document) at gather time, not hardcoded — the dev harness's
`data-sanity-target` attributes are picked up automatically when present, but every check works
on a page without them too.

**Accessibility** is a 7th section (`axe-core`, run via `scan/accessibility.ts`, excluding
`#sanity-panel-host` from its own scan). axe-core adds real weight to the bundle Sanity ships
inside a host site's `scripts.js` (~500KB / ~190KB gzip of the ~674KB / ~190KB total as of this
writing) — worth revisiting (e.g. dynamic `import()` on first open of that section) if bundle
size becomes a real constraint.

### Icons

`src/components/icons.tsx` is a small hand-authored set (20×20 viewBox, 1.6 stroke). Every
icon must set explicit intrinsic `width`/`height` — an SVG without them stretches to fill its
flex parent, which previously turned a chevron into a diagonal bar across a whole card. Follow
the existing `useBase()` pattern for new icons rather than hand-rolling `<svg>` props.
