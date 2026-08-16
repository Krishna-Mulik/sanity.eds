// Design tokens: a neutral zinc-black/white glass system with severity as
// the only color, in the register of Linear/Vercel/GitHub/Raycast's dark
// themes. Injected into the panel's own shadow root only, so nothing here
// can leak into the host page's cascade — and nothing in the host page can
// reach in.
import { jbm400, jbm500, jbm700 } from './fonts';

// Fonts are embedded as base64 data URIs, not root-relative `/fonts/*` URLs:
// this file ships inside an arbitrary host site's own scripts.js, so a
// root-relative path would resolve against *that site's* origin and 404
// there instead of loading anything.
export const tokensCss = /* css */ `
@font-face {
  font-family: 'Sanity Mono';
  src: url('${jbm400}') format('woff2');
  font-weight: 400; font-style: normal; font-display: swap;
}
@font-face {
  font-family: 'Sanity Mono';
  src: url('${jbm500}') format('woff2');
  font-weight: 500; font-style: normal; font-display: swap;
}
@font-face {
  font-family: 'Sanity Mono';
  src: url('${jbm700}') format('woff2');
  font-weight: 700; font-style: normal; font-display: swap;
}

:host {
  /* Neutral dark: true zinc-black, no hue tint — the register shared by
     Linear/Vercel/GitHub/Raycast's dark themes, not a colored "instrument"
     black. Color is spent entirely on semantic severity (below), never on
     the neutral scale itself. This is the base palette (also the fallback
     when the platform reports no preference at all). */
  --chassis: #09090b;
  --chassis-glass: rgba(9, 9, 11, 0.82);
  --panel: #131316;
  --panel-2: #1c1c20;
  --panel-3: #26262b;

  --line: rgba(255, 255, 255, 0.08);
  --line-2: rgba(255, 255, 255, 0.15);

  --text: #f7f7f8;
  --text-2: #a6a6ad;
  --text-3: #82828a;

  --normal: #2fce85;
  --warning: #f2b544;
  --critical: #f0524a;
  --idle: #82828a;
  --normal-dim: rgba(47, 206, 133, 0.14);
  --warning-dim: rgba(242, 181, 68, 0.14);
  --critical-dim: rgba(240, 82, 74, 0.15);
  --idle-dim: rgba(130, 130, 138, 0.14);
  /* Verdict-banner border tints, one step more saturated than -dim — kept as
     their own token (not built from -dim or var(--critical) at some opacity
     inline) so light mode can carry its own, separately-tuned value instead
     of inheriting dark's brighter hex, which is what shipped here before. */
  --normal-border: rgba(62, 207, 142, 0.28);
  --warning-border: rgba(240, 184, 73, 0.28);
  --critical-border: rgba(255, 95, 82, 0.3);

  /* A fixed near-white/near-black pair for chrome drawn over unpredictable
     photos (social card platform badges) — this never flips with theme,
     since the thing behind it is a photo, not the panel's own surface. */
  --on-photo: #f7f7f8;
  --on-photo-bg: rgba(9, 9, 11, 0.8);

  --mono: 'Sanity Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;

  --r-sm: 8px;
  --r-md: 12px;
  --r-lg: 18px;
  --r-xl: 26px;

  --shadow: 0 18px 48px rgba(0, 0, 0, 0.46), 0 2px 8px rgba(0, 0, 0, 0.3);
  --shadow-sm: 0 10px 26px rgba(0, 0, 0, 0.4);
  /* The inset edge that makes a glass surface read as a real material
     catching light, layered into each surface's own box-shadow. */
  --edge-highlight: inset 0 1px 0 rgba(255, 255, 255, 0.09);
  --sheen: linear-gradient(180deg, rgba(255, 255, 255, 0.07), rgba(255, 255, 255, 0));

  all: initial;
  display: block;
  color-scheme: dark;
}

/* Neutral light: the same true-zinc register as dark, lit instead of dark —
   not the sage-tinted grays an "instrument" reading would reach for. Semantic
   colors are deepened, not just re-shaded — a naive lightness-flip of the
   dark palette's green/amber/red reads as pastel wash on white and falls
   short of 4.5:1 at the small sizes this UI actually sets them at.

   Revised again for a real defect: the panel was reading as washed into the
   host page rather than floating above it — --chassis-glass at 0.78 let ~22%
   of an arbitrary (often warm/cream) host background bleed through the blur,
   and --line/--line-2 were too faint to give surfaces a defined edge on a
   near-white panel. Both raised here; dark is untouched since it never had
   this problem (a translucent near-black reads as present regardless). The
   old --warning (#916006) was also a genuine miss: an accessible amber this
   dark reads as olive-brown, not "amber" — every other hue in this palette
   reads clean at its required contrast, warning alone didn't. Replaced with
   a burnt-orange in the same family GitHub/Linear/Radix actually ship for a
   light-mode "attention" color (amber's native lightness fights AA contrast
   on white; orange's doesn't), still verified computationally at 4.5:1+.

   --text-2/--text-3 were a second instance of the same mistake at the
   neutral scale itself: #55555c and #6b6b73 have R/G/B within ~7 of each
   other, which reads as black diluted with white, not as a chosen color.
   Replaced with an actual cool slate (R/G/B spread ~20+) — same lightness
   steps, same job, but it now reads as an intentional gray rather than a
   faded one. --idle stays equal to --text-3, as it was before, since the
   two were already the same hex on purpose. */
@media (prefers-color-scheme: light) {
  :host {
    --chassis: #e9e9ec;
    --chassis-glass: rgba(236, 236, 239, 0.92);
    --panel: #f8f8f9;
    --panel-2: #fbfbfc;
    --panel-3: #ffffff;

    --line: rgba(20, 20, 23, 0.11);
    --line-2: rgba(20, 20, 23, 0.2);

    --text: #19191c;
    --text-2: #424957;
    --text-3: #5c6472;

    --normal: #167a49;
    --warning: #c2410c;
    --critical: #c22e20;
    --idle: #5c6472;
    --normal-dim: rgba(22, 122, 73, 0.12);
    --warning-dim: rgba(194, 65, 12, 0.12);
    --critical-dim: rgba(194, 46, 32, 0.12);
    --idle-dim: rgba(92, 100, 114, 0.12);
    --normal-border: rgba(22, 122, 73, 0.3);
    --warning-border: rgba(194, 65, 12, 0.3);
    --critical-border: rgba(194, 46, 32, 0.32);

    --shadow: 0 20px 44px rgba(20, 20, 23, 0.16), 0 4px 12px rgba(20, 20, 23, 0.1);
    --shadow-sm: 0 10px 24px rgba(20, 20, 23, 0.16);
    --edge-highlight: inset 0 1px 0 rgba(255, 255, 255, 0.9), inset 0 -1px 0 rgba(20, 20, 23, 0.05);
    --sheen: linear-gradient(180deg, rgba(255, 255, 255, 0.75), rgba(255, 255, 255, 0));

    color-scheme: light;
  }
}

:host, :host * { box-sizing: border-box; }

/* Zero-specificity reset: :host button would be (0,1,1) and would beat every
   single-class rule that tries to give a button a background. */
:where(button) {
  font: inherit; color: inherit; background: none;
  border: none; padding: 0; margin: 0; cursor: pointer;
  text-align: left; font-family: var(--sans);
}

:host :focus-visible {
  outline: 2px solid var(--normal);
  outline-offset: 2px;
  border-radius: 4px;
}

:host ::selection { background: var(--normal-dim); color: var(--text); }

:host ::-webkit-scrollbar { width: 8px; }
:host ::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.13);
  border-radius: 99px;
  border: 2px solid transparent;
  background-clip: content-box;
}
:host ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.22); background-clip: content-box; }
:host ::-webkit-scrollbar-track { background: transparent; }
`;
