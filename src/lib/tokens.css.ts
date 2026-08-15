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
   short of 4.5:1 at the small sizes this UI actually sets them at. */
@media (prefers-color-scheme: light) {
  :host {
    --chassis: #e9e9ec;
    --chassis-glass: rgba(233, 233, 236, 0.78);
    --panel: #f8f8f9;
    --panel-2: #fbfbfc;
    --panel-3: #ffffff;

    --line: rgba(20, 20, 23, 0.09);
    --line-2: rgba(20, 20, 23, 0.16);

    --text: #19191c;
    --text-2: #55555c;
    --text-3: #6b6b73;

    --normal: #167a49;
    --warning: #916006;
    --critical: #c22e20;
    --idle: #6b6b73;
    --normal-dim: rgba(22, 122, 73, 0.12);
    --warning-dim: rgba(145, 96, 6, 0.12);
    --critical-dim: rgba(194, 46, 32, 0.12);
    --idle-dim: rgba(107, 107, 115, 0.12);

    --shadow: 0 18px 40px rgba(20, 20, 23, 0.14), 0 3px 10px rgba(20, 20, 23, 0.08);
    --shadow-sm: 0 10px 22px rgba(20, 20, 23, 0.14);
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
