# Keeping it 100 — what we learned and what Sanity checks for it

Source: [aem.live/developer/keeping-it-100](https://www.aem.live/developer/keeping-it-100),
aem.live's guide to hitting a 100 Lighthouse/PageSpeed Insights score. This note records what
the doc actually says, which parts became real checks in `src/lib/scan/performance.ts`, why
those specific parts (and not others), and two bugs the research surfaced along the way.

## What the doc says

**Server-side rendering first.** Canonical content belongs in the markup the server sends, not
injected by client JS after load. Client-side rendering is reserved for genuinely non-canonical
content (listings, app-like widgets).

**The E-L-D loading model** — Eager / Lazy / Delayed:

- **Eager**: hide `<body>` until the first section and its LCP candidate are ready, to avoid
  downloading images before they're needed and to avoid layout shift. Show the body, then start
  loading fonts.
- **Lazy**: load every remaining section/block (JS + CSS) and lazy-load images outside the first
  section.
- **Delayed**: load non-critical third-party code (marketing tags, chat widgets, analytics) at
  least 3 seconds after LCP, gated behind consent.

**The concrete numeric target**: total network payload before the LCP candidate renders should
stay under **~100KB** to reliably land LCP under ~1.5s on mobile.

**Three rules that are counter-intuitive on purpose** — each one reads as a standard performance
win to a generic auditor, but aem.live's own testing found the opposite in this architecture:

1. Don't connect to a secondary origin before LCP — the DNS lookup + TLS handshake competes with
   the LCP candidate for the same limited early bandwidth.
2. Don't use `<link rel="preload">` or `fetchpriority="high"` before LCP, for the same reason.
3. Don't bother minifying JS/CSS unless a file is genuinely huge — EDS serves code block-by-block
   over HTTP/2, so minification's usual payload win is negligible, and it adds build complexity
   (source maps, tooling) for little return. `aem.js` itself ships unminified on purpose, to stay
   debuggable.

**Process guidance** (repo/CI-side, not page-runtime): redirect chains hurt CWV as measured by
RUM/CrUX; keep `<head>` free of marketing tech and inline scripts/styles; test every PR against
PageSpeed Insights and fail below 100 with a small volatility buffer, rather than trying to claw
back a score after it slips.

## What we built, and why

Sanity scans a *live, already-rendered* page — it has no view into the build pipeline, CI, or
git history, so anything in the doc that's a repo/process rule (PR gating, build tooling,
minification policy as a developer decision) is out of reach by design, same as the process
guidance in `dev-collab-and-good-practices` was. What's left is genuinely runtime-observable, and
three of the doc's rules were worth encoding as real checks, all in `performance.ts`:

| Check | Function | Why this one |
|---|---|---|
| Payload before LCP over ~100KB | `evaluateLcpPayloadBudget()` | The doc's one hard number. Sums Resource Timing `transferSize` for every resource whose `responseEnd` lands before the measured LCP timestamp — a byte budget Lighthouse's own score doesn't expose as a named figure, only as a downstream timing result. |
| Third-party origin connected before LCP | `evaluateEarlyThirdPartyConnections()` | Flags any cross-origin resource whose `startTime` is before LCP. Counter-intuitive: a generic auditor has no rule against "connecting early," so this is a case Sanity catches that a Lighthouse-style tool structurally can't name. |
| `<link rel="preload">` / `fetchpriority="high"` present at all | `evaluatePreloadHints()` | The strongest candidate of the three, because it's not just missed by generic tools — it's actively contradicted by them. Most performance advice (including Lighthouse's own suggestions) treats `preload`/`fetchpriority="high"` as an optimization. aem.live found they hurt LCP in this architecture. Flagging this is Sanity telling the user the opposite of what a generic auditor would say, which is exactly the kind of gap a purpose-built EDS tool exists to close. |

What we deliberately left out, and why:

- **Minification policy** — the doc argues *against* minifying, so there's nothing to check for;
  building a "your bundle isn't minified" finding would actively contradict the guidance.
- **Redirect chains** — already covered (`limits-redirects` in `limits.ts`); no new check needed.
- **`<head>` hygiene / third-party script blocking render** — already covered in spirit by the
  existing render-blocking detection (`evaluateRenderBlocking`) and the third-party script
  inventory in `security.ts`; a dedicated "martech in head" check would just be a narrower
  duplicate of a symptom we already catch generically.
- **Generic lazy-loading / LCP-element-not-lazy checks** — real, but these are standard Lighthouse
  audits (`offscreen-images`, "LCP element was lazily loaded") that PageSpeed Insights already
  runs authoritatively against the actual rendered page. Rebuilding a weaker version client-side
  wouldn't add signal, following the same reasoning that moved alt-text and heading-order checks
  to axe-core earlier in this project rather than hand-rolling them.
- **"Hide body until first section is ready"** — not reliably observable after the fact. By the
  time Sanity's scan runs (post-load), the body is already visible; there's no residual DOM marker
  proving whether the E phase's hide/show sequence actually happened correctly.
- **PR-level PageSpeed Insights gating** — a CI/CD process step, not a page-runtime fact.

## Two bugs this work surfaced

**Sanity was recommending the opposite of this guidance.** `buildRecommendations()` told users to
*"Preload... the largest above-the-fold image... driving LCP"* when LCP was bad — directly
contradicting the rule just implemented. Fixed the wording to point at compression/right-sizing
and explicitly warn against preload/early third-party connections instead.

**Performance findings were computed but never shown.** Adding the three checks above meant
looking at how `performanceFindings` (large bundles, duplicate requests, runtime errors, and now
these three) actually reached the user — and it turned out they didn't. The array was folded into
section severity/badge counts in `scan/index.ts` but was never part of `ScanResult` and was never
rendered by `PerformanceSection`, which only showed the CWV grid, render-blockers, and a generic
text recommendation list. So a large bundle could turn the Speed badge red with no explanation
visible anywhere in the panel. Fixed by adding `performanceFindings` to `ScanResult` and a
`Findings` block to `PerformanceSection` (`Block` + `FindingRow` + `SeverityCounts`, the same
vocabulary every other section already uses) — verified live that the previously-invisible large
bundle finding and the new preload warning both now render with full detail and a locate-on-page
path.

## Verification

- 10 new unit tests in `performance.test.ts` covering the LCP-budget, early-third-party, and
  preload-hint evaluators, plus a regression test asserting the LCP recommendation never starts
  with "Preload."
- `tsc -b --noEmit` clean, full suite green (167 tests).
- Live-verified in the dev harness: added a deliberate `<link rel="preload">` to `index.html` to
  prove the preload check fires with the correct detail text and a working locate-on-page control.
- The two LCP-timing checks (`evaluateLcpPayloadBudget`, `evaluateEarlyThirdPartyConnections`)
  couldn't be proven live in this environment — the automated Browser pane never emits a real
  `largest-contentful-paint` entry (`performance.getEntriesByType('largest-contentful-paint')`
  stayed empty after a hard reload and a 3s wait), a pre-existing environment limitation, not a
  regression. They rely on unit-test coverage of the pure `evaluateX` logic instead, consistent
  with this project's `gatherX`/`evaluateX` split.
