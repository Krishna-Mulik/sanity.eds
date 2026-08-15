# Design

<!-- impeccable:design-doc 2 -->

The visual world is **neutral zinc-black glass**: a true-gray dark register with severity as
the only color, in the family of Linear, Vercel, GitHub, and Raycast's dark themes — floating
translucent surfaces, one radius scale, no decorative hue. This is recorded from the built
implementation, not from intention.

**Revision history:** the first built direction was Vitals Monitor, a bedside clinical
instrument — chassis and panels tinted teal-black, semantic colors kept close to real IEC
60601-1-8 patient-monitor hues (a real standard, checked, not invented). The user explicitly
rejected it ("don't use vitals monitor theme") in favor of whatever reads as current,
well-regarded dark UI right now. That is a directive, not a taste call this document argues
with: the tables below are the *current* palette, and the instrument direction is dead — do
not resurrect its teal tint or clinical framing from old memory, git history, or habit.

## Constraints that shape everything

The panel is injected into somebody else's live page, inside a Shadow DOM root, with no
iframe. So: it never inherits or leaks styles, it floats above arbitrary unknown content,
and it must stay legible over any background. All CSS lives in `src/lib/tokens.css.ts`
(tokens, resets) and `src/lib/panel.css.ts` (components), injected as one stylesheet into
the shadow root by `src/lib/mount.tsx`.

## Colour

Semantic only. There is no decorative colour anywhere in the panel.

| Role | Token | Dark | Light |
| --- | --- | --- | --- |
| Chassis | `--chassis` | `#09090b` | `#e9e9ec` |
| Chassis, translucent | `--chassis-glass` | `rgba(9,9,11,.82)` | `rgba(233,233,236,.78)` |
| Surface / raised / raised-2 | `--panel` `--panel-2` `--panel-3` | `#131316` `#1c1c20` `#26262b` | `#f8f8f9` `#fbfbfc` `#ffffff` |
| Text / secondary / tertiary | `--text` `--text-2` `--text-3` | `#f7f7f8` `#a6a6ad` `#82828a` | `#19191c` `#55555c` `#6b6b73` |
| Normal | `--normal` | `#2fce85` | `#167a49` |
| Warning | `--warning` | `#f2b544` | `#916006` |
| Critical | `--critical` | `#f0524a` | `#c22e20` |
| Not run | `--idle` | `#82828a` | `#6b6b73` |

The neutral scale is **true zinc** — no hue tint on chassis/panel/text at all, top to bottom.
That is the actual point of this palette family (Linear/Vercel/GitHub/Raycast all share it):
color is spent entirely on the four semantic states, never on the surfaces those states sit
on. Each severity has a `-dim` companion at ~12–14% alpha for fills and rings. Hairlines are
a neutral overlay at 8–9% (`--line`) and 15–16% (`--line-2`) — literally white in dark mode,
literally near-black in light mode, both expressed as the same alpha-over-surface idea.

### Light and dark, both committed

`prefers-color-scheme` drives the theme; there is no in-panel toggle, since the ask was to
follow the *platform's* preference, not add a second one. Dark is the base `:host` block
(also the fallback when a UA reports no preference at all); light lives entirely in one
`@media (prefers-color-scheme: light)` override in `src/lib/tokens.css.ts` and touches only
custom properties — no component in `panel.css.ts` branches on theme itself, every rule just
reads a token.

Light is not the dark palette's hues inverted and lightened — that was tried first and failed
AA: dark-mode-bright semantic colors read as pastel wash on a light surface and land at
3.5–4.2:1 at the small sizes this UI actually sets them in (status text, tag values, measure
numbers). Light's semantic colours are independently deepened to clear 4.5:1 against `--panel`
at those same sizes — verified computationally (relative-luminance WCAG formula), not
eyeballed — every time either palette's semantic hexes change, not just once at launch.

The panel must read as its own floating surface, clearly not part of the host page, **in
either theme** — that survived the instrument-to-neutral rewrite unchanged, since it's a
boundary requirement (Shadow DOM injected over an arbitrary unknown page), not a stylistic
choice. A few surfaces are deliberately theme-**invariant** for exactly that boundary reason:

- `--on-photo` / `--on-photo-bg` — the social-card platform badge sits on an arbitrary,
  unpredictable photo, not on the panel's own surface, so it stays fixed light-on-dark
  regardless of theme. (This used to read `var(--text)` on a hardcoded dark pill — a real bug
  that would have gone near-black-on-dark the moment light mode shipped; caught while adding
  the light palette, not before.)
- `--edge-highlight`, `--shadow`, `--shadow-sm`, `--sheen` — the "glass catching light" effect
  a translucent material needs, redefined per theme (light glass wants a much stronger, crisper
  top highlight than dark glass) but always applied through the same token so no component
  hardcodes an `rgba(255,255,255,…)` literal that only makes sense in one theme.

`prefers-contrast: more` is layered on top of *whichever* theme is active — it strengthens
`--line`/`--text-2`/`--text-3` and drops translucency, but reads `var(--chassis)` rather than a
hardcoded dark hex, so a light-mode user with high contrast enabled gets a strengthened light
panel, not a forced dark one.

**Severity colour is duplicated as hex in `src/lib/severity.ts`.** Highlights drawn on the
host page live in the light DOM, where `:host` custom properties cannot reach.

`.sk-score-num` (the big Speed-section readout) was hardcoded to `var(--warning)` regardless
of the section's actual severity — a passing score would still render amber. Caught, not
introduced, during this rewrite; fixed to inherit from the parent `.sk-verdict`'s severity
class like `.sk-verdict-num` already did. Worth remembering: any big numeral gets its color
from the nearest severity-classed ancestor, never a flat token.

## Type

Two families, each with a job.

- **Monospace** — self-hosted JetBrains Mono as `Sanity Mono`, weights 400/500/700
  (`public/fonts/`). Used for every measured value: readouts, counts, asset paths, tag names,
  severity labels. Monospace here is measurement, not costume (craft-floor bans monospace as
  a "technical" costume — this earns it back because every use is an actual measured value).
- **Platform sans** — system stack. Titles, descriptions, controls.

Tracking is size-specific, never one value:

| Use | Size | Weight | Tracking | Leading |
| --- | --- | --- | --- | --- |
| Score readout | 44px | 700 | `-0.035em` | 1 |
| Verdict count | 34px | 700 | `-0.03em` | 1 |
| Metric value | 19px | 600 | `-0.02em` | 1.1 |
| Panel title | 17px | 650 | `-0.015em` | 1.15 |
| Finding title | 12.5px | 650 | `-0.005em` | 1.3 |
| Body detail | 11.5px | 400 | 0 | 1.5 |
| Block heading | 10.5px | 700 | `+0.1em` uppercase | — |

Large text gets negative tracking, small text opens up. Section headings are uppercase mono
labels; they are the only uppercase in the system.

## Shape and material

One radius scale: `8 / 12 / 18 / 26px` (`--r-sm` … `--r-xl`), plus full-round for the ball,
bubbles, badges and pills. No nested cards; grouped rows use 1px hairlines over a `--line`
background with a single rounded clip.

Floating surfaces are translucent glass: `backdrop-filter: blur(28px) saturate(170%)` on the
panel, `blur(14px)` on ball and bubbles, over `--chassis-glass`. Every glass surface carries
`var(--edge-highlight)` — an inset top highlight (plus, in light mode, a second inset hairline
on the bottom edge) — so it reads as a real edge catching light. Shadows are offset and
blurred, never a zero-offset halo, and tinted from the neutral scale rather than pure black.

## Structure

`src/components/blocks.tsx` holds the whole vocabulary. Sections compose from it and add
nothing of their own:

- `Block` — heading plus optional right-aligned meta count.
- `FindingRow` — severity dot, title, severity label, plain-language detail, optional
  measured-vs-allowed line, optional asset path. **Always fully expanded.**
- `MetricCell` — label, value, target.
- `AllClear` — the empty state.

The launcher is a docked assistive ball. Hovering (or tapping) pops six section bubbles into
a **honeycomb cluster** beside it, laid out in `src/lib/geometry.ts`: two hex-packed columns
of three, neighbouring columns `sin(60°)` apart and staggered half a step, with gaps sized
for the count badge that overhangs each bubble's corner. An arc was tried first and rejected
— six bubbles on an arc must reach far across the host page to stop touching, while hex
packing keeps them adjacent and close to the thing that opened them. The cluster slides
vertically as a whole when the ball sits near the top or bottom of the viewport.

Choosing a bubble grows a phone-shaped panel out of the ball's position, with a six-item tab
bar at the foot.

The hovered bubble's name shows as a single label anchored to the **ball**, not to whichever
bubble the cursor is over: a packed cluster has no clear space beside a bubble to put a
tooltip, and a fixed position reads faster than six cramped ones jumping around. The label
flips from above the ball to below it once the ball is dragged within 52px of the viewport
top, the same edge problem the cluster's own vertical shift solves for the bubbles.

## Motion

Springs, not scripted animation, for anything the user can grab. `src/lib/spring.ts`
implements Apple's designer-facing parameters (damping ratio + response) over a fixed-substep
integrator, plus momentum projection and rubber-banding.

- **Ball drag** — 1:1 tracking that respects the grab offset, progressive resistance past the
  top and bottom bounds, and on release the landing point is projected from the flick velocity
  and handed to the spring as initial velocity, so there is no seam between drag and animation.
  X and Y are independent springs.
- **Cluster pop-out** — 380ms exponential decelerate (`cubic-bezier(0.16, 1, 0.3, 1)`),
  staggered 26ms per bubble outward from the ball, reversing order on close.
- **Panel** — materialises rather than fades: scale, opacity and blur move together, with
  `transform-origin` anchored to the ball it grew from.
- **Section switch** — `PhonePanel`'s content wrapper is keyed by the active section id
  (`<div class="sk-section" key={active}>`), so Preact remounts it on every tab/bubble change
  and its 240ms rise-and-fade mount animation replays. This is what makes switching sections
  read as moving to a new page rather than a hard content swap — the same "enter/exit along a
  path" idea as the panel's own materialise-in, just triggered by navigation instead of open.
- **Theme change** — the top-level chrome (ball, bubbles, panel, verdict banner, tiles) carries
  a 140–200ms `background-color`/`border-color` transition, so a mid-session OS theme flip
  crossfades instead of snapping. Deeper content (finding rows, tag lists) does not animate the
  flip — real apps don't animate every card on a system theme change, only the primary chrome.
- **Press feedback** — every interactive surface responds on press, not just on click/release
  (bubbles use `filter: brightness()` rather than fighting their own position `transform`).

No bounce or elastic easing. Overshoot belongs to momentum-driven gestures; a menu opening
from a hover carries none, so it decelerates smoothly instead.

## Accessibility

Three preference queries are honoured, each doing something different:

- `prefers-reduced-motion` — transforms collapse to instant, panel becomes a plain fade, the
  scanning pulse stops.
- `prefers-reduced-transparency` — every glass surface goes solid, blur removed.
- `prefers-contrast: more` — hairlines and secondary text strengthen, surfaces go near-solid.

Escape closes the panel. Bubbles leave the tab order while the fan is closed. Icons are
`aria-hidden` with labels on their controls. Focus rings are 2px `--normal` at 2px offset.

## Icons

One family, hand-authored in `src/components/icons.tsx`: 20×20 grid, 1.6 stroke, round caps
and joins, rendered at 13–21px. **Every icon takes an intrinsic `width`/`height`** — an SVG
without them stretches to fill its flex parent, which once turned a chevron into a diagonal
bar across a card.

## Verifying visual work

`node tools/shoot.mjs <outDir>` drives the panel through every section at desktop and mobile
and writes PNGs. Visual changes are reviewed from those files, not from DOM assertions.
