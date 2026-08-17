export const panelCss = /* css */ `
.sk-root { position: static; font-family: var(--sans); }

.sk-iconbtn {
  flex: none;
  width: 30px; height: 30px;
  display: grid; place-items: center;
  border-radius: var(--r-sm);
  color: var(--text-3);
  transition: background 140ms ease, color 140ms ease, transform 140ms ease;
}
.sk-iconbtn:active { transform: scale(0.94); }

/* ============ Launcher ============ */

.sk-launcher {
  position: fixed;
  z-index: 2147483001;
  top: 0;
  width: 56px; height: 56px;
  transform: translateY(var(--ball-y, 0px));
  transition: opacity 200ms ease, visibility 200ms;
}
.sk-launcher[data-side='right'] { right: 20px; }
.sk-launcher[data-side='left']  { left: 20px; }
.sk-launcher[data-hidden] { opacity: 0; visibility: hidden; pointer-events: none; }

.sk-ball {
  position: relative;
  width: 56px; height: 56px;
  border-radius: 50%;
  display: grid; place-items: center;
  color: var(--text-2);
  background: var(--sheen), var(--chassis-glass);
  backdrop-filter: blur(14px) saturate(150%);
  -webkit-backdrop-filter: blur(14px) saturate(150%);
  border: 1px solid var(--line-2);
  box-shadow: var(--shadow), var(--edge-highlight);
  touch-action: none;
  cursor: grab;
  transition:
    transform 220ms cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 220ms ease,
    color 220ms ease,
    background-color 200ms ease,
    border-color 200ms ease;
}
.sk-ball:active { cursor: grabbing; }
.sk-ball[data-expanded] { transform: scale(1.06); }
.sk-ball-face { display: grid; place-items: center; }

.sk-ball.is-critical { color: var(--critical); box-shadow: var(--shadow), 0 0 0 4px var(--critical-dim); }
.sk-ball.is-warning  { color: var(--warning);  box-shadow: var(--shadow), 0 0 0 4px var(--warning-dim); }
.sk-ball.is-normal   { color: var(--normal); }
.sk-ball.is-idle     { color: var(--text-3); }

.sk-ball[data-scanning] .sk-ball-face { animation: sk-breathe 1.25s ease-in-out infinite; }
@keyframes sk-breathe { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }

.sk-ball-badge {
  position: absolute; top: -2px; right: -2px;
  min-width: 20px; height: 20px; padding: 0 5px;
  display: grid; place-items: center;
  border-radius: 99px;
  background: var(--critical);
  color: #26060a;
  font-family: var(--mono);
  font-size: 11px; font-weight: 700; letter-spacing: 0;
  border: 2px solid var(--chassis);
}

/* Fan-out menu */
.sk-fan { position: absolute; inset: 0; pointer-events: none; }
.sk-fan[data-open] { pointer-events: auto; }

.sk-bubble {
  position: absolute; top: 0; left: 0;
  width: var(--bubble, 46px); height: var(--bubble, 46px);
  border-radius: 50%;
  display: grid; place-items: center;
  color: var(--text-2);
  background: var(--chassis-glass);
  backdrop-filter: blur(14px) saturate(150%);
  -webkit-backdrop-filter: blur(14px) saturate(150%);
  border: 1px solid var(--line-2);
  box-shadow: var(--shadow-sm);
  transform: translate(0, 0) scale(0.3);
  opacity: 0;
  /* Exponential decelerate, no overshoot: opening a menu carries no momentum,
     so a bounce here would be decoration rather than physics. */
  transition:
    transform 380ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 180ms ease,
    color 160ms ease,
    background-color 160ms ease,
    filter 100ms ease;
}
.sk-fan[data-open] .sk-bubble {
  transform: translate(var(--dx), var(--dy)) scale(1);
  opacity: 1;
}
.sk-bubble:focus-visible { background: var(--panel-3); color: var(--text); z-index: 3; }
/* Feedback on the press itself, not just on the click that navigates away. */
.sk-bubble:active { filter: brightness(0.92); }
.sk-bubble.is-critical { color: var(--critical); }
.sk-bubble.is-warning { color: var(--warning); }
.sk-bubble.is-normal { color: var(--normal); }

/* Background is set per severity, never currentColor: the badge also
   overrides color for its own label, which would collapse both to one tone. */
.sk-bubble-badge {
  position: absolute; top: -1px; right: -1px;
  min-width: 16px; height: 16px; padding: 0 3px;
  display: grid; place-items: center;
  border-radius: 99px;
  background: var(--idle);
  color: #06120f;
  border: 1.5px solid var(--chassis);
  font-family: var(--mono); font-size: 9.5px; font-weight: 700;
}
.sk-bubble.is-critical .sk-bubble-badge { background: var(--critical); color: #2a0708; }
.sk-bubble.is-warning  .sk-bubble-badge { background: var(--warning);  color: #2b1f05; }
.sk-bubble.is-normal   .sk-bubble-badge { background: var(--normal);   color: #06120f; }

/* One stable label on the ball itself, not on whichever bubble the cursor
   happens to be over: a packed cluster has no clear space beside a bubble,
   and a single fixed position reads faster than six cramped ones anyway. */
.sk-ball-label {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 10px);
  transform: translate(-50%, 4px);
  z-index: 5;
  max-width: 140px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 11.5px; font-weight: 650; letter-spacing: 0.01em;
  color: var(--text);
  background: var(--chassis);
  border: 1px solid var(--line-2);
  box-shadow: var(--shadow-sm);
  padding: 4px 10px;
  border-radius: 99px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 130ms ease, transform 130ms cubic-bezier(0.16, 1, 0.3, 1);
}
.sk-ball-label.is-visible { opacity: 1; transform: translate(-50%, 0); }
.sk-ball-label.is-below {
  bottom: auto;
  top: calc(100% + 10px);
  transform: translate(-50%, -4px);
}
.sk-ball-label.is-below.is-visible { transform: translate(-50%, 0); }

/* ============ Panel ============ */

.sk-panel {
  position: fixed;
  z-index: 2147483000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: var(--r-xl);
  background: var(--chassis-glass);
  backdrop-filter: blur(28px) saturate(170%);
  -webkit-backdrop-filter: blur(28px) saturate(170%);
  border: 1px solid var(--line-2);
  box-shadow: var(--shadow), var(--edge-highlight);
  animation: sk-panel-in 380ms cubic-bezier(0.22, 1, 0.36, 1) both;
  transition: background-color 200ms ease, border-color 200ms ease;
}
/* Materialises rather than fades: blur and scale move together, so it reads
   as a real surface arriving from the ball it grew out of. */
@keyframes sk-panel-in {
  from { opacity: 0; transform: scale(0.86); filter: blur(6px); }
  to   { opacity: 1; transform: scale(1);    filter: blur(0); }
}
/* Closing must animate too, or the panel just vanishes mid-interaction —
   the exact "jarring change" the entrance animation was built to avoid.
   Quicker than the entrance (180ms vs 380ms): the user is dismissing, not
   waiting to read something new, so the exit should get out of the way. */
.sk-panel[data-closing] {
  animation: sk-panel-out 180ms cubic-bezier(0.4, 0, 1, 1) both;
  pointer-events: none;
}
@keyframes sk-panel-out {
  from { opacity: 1; transform: scale(1);    filter: blur(0); }
  to   { opacity: 0; transform: scale(0.92); filter: blur(4px); }
}

.sk-panel-head {
  flex: none;
  display: flex; align-items: center; gap: 12px;
  padding: 16px 14px 12px 20px;
}
.sk-panel-heading { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.sk-panel-title {
  margin: 0;
  font-size: 17px; font-weight: 650;
  letter-spacing: -0.015em;  /* large text needs negative tracking */
  line-height: 1.15;
  color: var(--text);
}
.sk-panel-status {
  font-size: 11.5px; letter-spacing: 0.005em;
  color: var(--text-3);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.sk-panel-status.is-critical { color: var(--critical); }
.sk-panel-status.is-warning { color: var(--warning); }
.sk-panel-status.is-normal { color: var(--normal); }

.sk-screen {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 4px 20px 22px;
  /* Bottom only: content fades before it meets the tab bar. A top fade was
     tried too, but .sk-panel-head is a sibling, not an overlapping sticky
     bar — nothing actually scrolls under it — so it only ever washed out
     whatever block happened to be first (e.g. Social's "Preview" title),
     permanently, since content at rest at the top has no further to scroll
     to escape it. */
  mask-image: linear-gradient(to bottom, #000 0, #000 calc(100% - 12px), transparent 100%);
}
/* Remounts (keyed by section id) each time the active section changes, so
   switching tabs reads as moving to a new page, not a hard content swap. */
.sk-section {
  display: flex; flex-direction: column; gap: 20px;
  animation: sk-section-in 240ms cubic-bezier(0.16, 1, 0.3, 1) both;
}
@keyframes sk-section-in {
  from { opacity: 0; transform: translateY(5px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ============ Blocks ============ */

.sk-block { display: flex; flex-direction: column; gap: 9px; }
.sk-block-head { display: flex; align-items: baseline; gap: 8px; }
.sk-block-title {
  margin: 0;
  font-size: 10.5px; font-weight: 700;
  letter-spacing: 0.1em;  /* small text opens up */
  text-transform: uppercase;
  color: var(--text-3);
}
.sk-block-meta { margin-left: auto; font-size: 10.5px; color: var(--text-3); font-family: var(--mono); }

.sk-counts { display: flex; align-items: center; gap: 6px; margin-left: auto; }
.sk-count {
  min-width: 20px; height: 20px; padding: 0 6px;
  border-radius: 99px;
  display: inline-flex; align-items: center; justify-content: center;
  font-family: var(--mono); font-size: 10.5px; font-weight: 700;
}
.sk-count.is-critical { color: var(--critical); background: var(--critical-dim); }
.sk-count.is-warning  { color: var(--warning);  background: var(--warning-dim); }
.sk-count.is-normal   { color: var(--normal);   background: var(--normal-dim); }

/* Verdict */
.sk-verdict {
  border-radius: var(--r-lg);
  border: 1px solid var(--line);
  background: var(--panel);
  padding: 16px 18px 14px;
  display: flex; flex-direction: column; gap: 6px;
  transition: background-color 200ms ease, border-color 200ms ease;
}
.sk-verdict.is-critical { background: linear-gradient(180deg, var(--critical-dim), transparent 70%), var(--panel); border-color: var(--critical-border); }
.sk-verdict.is-warning  { background: linear-gradient(180deg, var(--warning-dim), transparent 70%), var(--panel); border-color: var(--warning-border); }
.sk-verdict.is-normal   { background: linear-gradient(180deg, var(--normal-dim), transparent 70%), var(--panel); border-color: var(--normal-border); }

.sk-verdict-counts { display: flex; align-items: baseline; gap: 7px; }
.sk-verdict-num {
  font-family: var(--mono); font-size: 34px; font-weight: 700;
  line-height: 1; letter-spacing: -0.03em; color: var(--critical);
}
.sk-verdict-num.is-warning { color: var(--warning); }
.sk-verdict-unit { font-size: 11.5px; color: var(--text-2); }
.sk-verdict-div { width: 1px; height: 20px; background: var(--line-2); margin: 0 6px; align-self: center; }
.sk-verdict-note { margin: 0; font-size: 12px; line-height: 1.5; color: var(--text-2); }

.sk-score { display: flex; align-items: baseline; gap: 3px; }
.sk-score-num {
  font-family: var(--mono); font-size: 44px; font-weight: 700;
  line-height: 1; letter-spacing: -0.035em; color: var(--critical);
}
/* Driven by the parent .sk-verdict's severity, not fixed to one color: a
   passing score must not still render in alarm-amber. */
.sk-verdict.is-warning .sk-score-num { color: var(--warning); }
.sk-verdict.is-normal  .sk-score-num { color: var(--normal); }
.sk-score-unit { font-family: var(--mono); font-size: 14px; color: var(--text-3); }

/* Summary section list. One row per section: five items never divide evenly
   into two columns, and a row has space for the section's actual name. */
.sk-tilegrid { display: flex; flex-direction: column; gap: 6px; }
.sk-tile {
  border-radius: var(--r-md);
  border: 1px solid var(--line);
  background: var(--panel);
  padding: 9px 11px;
  display: flex; align-items: center; gap: 11px;
  color: var(--text-3);
  transition: background-color 140ms ease, border-color 140ms ease, transform 140ms ease;
}
.sk-tile:active { transform: scale(0.99); }
.sk-tile-icon {
  flex: none; width: 32px; height: 32px; border-radius: 10px;
  display: grid; place-items: center; background: var(--panel-3);
}
.sk-tile-label {
  flex: 1; min-width: 0;
  font-size: 12.5px; font-weight: 650; letter-spacing: -0.005em; color: var(--text);
}
.sk-tile-reading {
  font-family: var(--mono); font-size: 16px; font-weight: 700;
  line-height: 1; letter-spacing: -0.02em; color: var(--text);
}
.sk-tile-status { flex: none; font-size: 10.5px; color: var(--text-3); min-width: 54px; text-align: right; }
.sk-tile.is-critical .sk-tile-icon { color: var(--critical); background: var(--critical-dim); }
.sk-tile.is-warning  .sk-tile-icon { color: var(--warning);  background: var(--warning-dim); }
.sk-tile.is-normal   .sk-tile-icon { color: var(--normal);   background: var(--normal-dim); }
.sk-tile.is-critical .sk-tile-reading { color: var(--critical); }
.sk-tile.is-warning  .sk-tile-reading { color: var(--warning); }

/* Metric grid */
.sk-metricgrid {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 1px; background: var(--line);
  border: 1px solid var(--line); border-radius: var(--r-md); overflow: hidden;
}
.sk-metric { background: var(--panel); padding: 10px 12px; display: flex; flex-direction: column; gap: 2px; }
.sk-metric-label { font-size: 10px; font-weight: 600; letter-spacing: 0.09em; text-transform: uppercase; color: var(--text-3); }
.sk-metric-value { font-family: var(--mono); font-size: 19px; font-weight: 600; line-height: 1.1; letter-spacing: -0.02em; color: var(--text); }
.sk-metric-target { font-size: 10px; color: var(--text-3); }

/* Heading outline (SEO > Structure) */
.sk-headingchain { display: flex; flex-direction: column; gap: 6px; }
.sk-heading-break { display: flex; align-items: center; gap: 4px; }
.sk-heading-sep { color: var(--text-3); font-size: 12px; }
.sk-heading-sep.is-broken { color: var(--warning); font-weight: 700; }
.sk-heading-chip {
  font-family: var(--mono); font-size: 11px; font-weight: 600;
  padding: 4px 8px; border-radius: var(--r-sm);
  background: var(--chassis); border: 1px solid var(--line); color: var(--text-2);
  cursor: pointer;
  transition: border-color 140ms ease, color 140ms ease, background 140ms ease, transform 140ms ease;
}
.sk-heading-chip:hover { border-color: var(--normal); color: var(--normal); background: var(--normal-dim); }
.sk-heading-chip:active { transform: scale(0.96); }
.sk-heading-chip.is-broken { border-color: var(--warning); color: var(--warning); background: var(--warning-dim); }
.sk-heading-chip.is-broken:hover { border-color: var(--warning); color: var(--warning); background: var(--warning-dim); }
.sk-empty-note { margin: 0; font-size: 11.5px; color: var(--text-3); }

/* Fonts (SEO > Structure) */
.sk-fontlist { display: flex; flex-wrap: wrap; gap: 6px; }
.sk-font-chip {
  font-family: var(--mono); font-size: 11px; font-weight: 600;
  padding: 4px 8px; border-radius: var(--r-sm);
  background: var(--chassis); border: 1px solid var(--line); color: var(--text-2);
}
.sk-metric.is-critical .sk-metric-value { color: var(--critical); }
.sk-metric.is-warning  .sk-metric-value { color: var(--warning); }
.sk-metric.is-normal   .sk-metric-value { color: var(--normal); }

/* Generic rows */
.sk-rows { display: flex; flex-direction: column; gap: 1px; background: var(--line); border: 1px solid var(--line); border-radius: var(--r-md); overflow: hidden; }
.sk-row { background: var(--panel); padding: 10px 12px; display: flex; align-items: center; gap: 10px; }
.sk-row-main { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.sk-row-path { font-family: var(--mono); font-size: 11.5px; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sk-row-detail { font-size: 11px; color: var(--text-3); line-height: 1.4; }
.sk-row-value { margin-left: auto; flex: none; font-family: var(--mono); font-size: 12px; font-weight: 700; letter-spacing: -0.01em; }
.sk-row.is-critical .sk-row-value { color: var(--critical); }
.sk-row.is-warning  .sk-row-value { color: var(--warning); }
.sk-row.is-actionable {
  width: 100%; border: none; text-align: left; font: inherit; color: inherit; cursor: pointer;
  transition: background 140ms ease, color 140ms ease;
}
.sk-row.is-actionable:hover { background: var(--chassis); color: var(--normal); }
.sk-row.is-actionable:active { background: var(--chassis); }
.sk-row.is-actionable.is-copied { background: var(--normal-dim); color: var(--normal); }

/* Findings — always open, never an accordion */
.sk-findings { display: flex; flex-direction: column; gap: 8px; }
.sk-finding {
  border-radius: var(--r-md);
  border: 1px solid var(--line);
  background: var(--panel);
  padding: 11px 13px 12px;
  display: flex; flex-direction: column; gap: 6px;
}
.sk-finding-head { display: flex; align-items: center; gap: 8px; }
.sk-finding-dot { flex: none; width: 7px; height: 7px; border-radius: 50%; background: var(--idle); }
.sk-finding.is-critical .sk-finding-dot { background: var(--critical); }
.sk-finding.is-warning  .sk-finding-dot { background: var(--warning); }
.sk-finding.is-normal   .sk-finding-dot { background: var(--normal); }
.sk-finding-title { flex: 1; margin: 0; font-size: 12.5px; font-weight: 650; letter-spacing: -0.005em; color: var(--text); line-height: 1.3; }
.sk-finding-sev { flex: none; font-family: var(--mono); font-size: 9.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-3); }
.sk-finding.is-critical .sk-finding-sev { color: var(--critical); }
.sk-finding.is-warning  .sk-finding-sev { color: var(--warning); }
.sk-finding-detail { margin: 0; font-size: 11.5px; line-height: 1.5; color: var(--text-2); overflow: hidden; text-overflow: ellipsis; }

.sk-finding-measure { margin: 0; display: flex; align-items: baseline; gap: 5px; font-size: 11px; color: var(--text-3); }
.sk-measure-value { font-family: var(--mono); font-size: 13px; font-weight: 700; color: var(--critical); letter-spacing: -0.01em; }
.sk-finding.is-warning .sk-measure-value { color: var(--warning); }
.sk-measure-allowed { font-family: var(--mono); font-size: 12px; color: var(--text-2); }

.sk-path {
  margin: 0;
  align-self: flex-start; max-width: 100%;
  display: flex; align-items: center; gap: 7px;
  padding: 6px 9px;
  border-radius: var(--r-sm);
  background: var(--chassis);
  border: 1px solid var(--line);
  color: var(--text-2);
}
.sk-path-text { font-family: var(--mono); font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; direction: ltr; }
.sk-path.is-actionable { transition: border-color 140ms ease, color 140ms ease, background 140ms ease, transform 140ms ease; }
.sk-path.is-actionable:active { transform: scale(0.98); }
.sk-path.is-actionable.is-copied { border-color: var(--normal); color: var(--normal); background: var(--normal-dim); }

/* Recommendations */
.sk-reco { margin: 0; padding: 0; list-style: none; counter-reset: r; display: flex; flex-direction: column; gap: 8px; }
.sk-reco li {
  counter-increment: r;
  display: grid; grid-template-columns: 18px 1fr; gap: 9px;
  font-size: 11.5px; line-height: 1.55; color: var(--text-2);
}
.sk-reco li::before {
  content: counter(r);
  font-family: var(--mono); font-size: 10px; font-weight: 700;
  color: var(--text-3);
  background: var(--panel-2);
  border-radius: 5px;
  width: 18px; height: 18px;
  display: grid; place-items: center;
  margin-top: 1px;
}

/* Sub-tabs — a segmented control in the same tab-bar register as the
   panel's own section tabs, scoped smaller for switching views *within* a
   section (Social's platform switcher, SEO's analysis groups, etc.). */
.sk-subtabs { display: flex; gap: 3px; padding: 3px; background: var(--panel); border: 1px solid var(--line); border-radius: var(--r-md); }
.sk-subtab {
  flex: 1;
  padding: 7px 4px;
  border-radius: 9px;
  font-size: 10.5px; font-weight: 600;
  color: var(--text-3);
  text-align: center;
  transition: background 140ms ease, color 140ms ease;
}
.sk-subtab.is-active { background: var(--panel-3); color: var(--text); }

/* Platform preview mockups — deliberately hardcoded to each platform's own
   real (theme-independent) chrome colors, not the panel's tokens: the whole
   point is showing what a foreign surface looks like, the same reasoning
   that keeps the host harness in index.html a different visual world from
   the panel itself. */
.sk-mock { border-radius: var(--r-md); overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; }
.sk-mock-media { aspect-ratio: 1.91 / 1; background: #d9d9d9; }
.sk-mock-media img { width: 100%; height: 100%; object-fit: cover; display: block; }
.sk-mock-body { display: flex; flex-direction: column; gap: 3px; }
.sk-mock-title { font-weight: 700; line-height: 1.3; }
.sk-mock-desc { line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.sk-mock-domain { line-height: 1.3; }

.sk-mock-facebook { background: #ffffff; border: 1px solid #dadde1; }
.sk-mock-facebook .sk-mock-body { background: #f2f3f5; padding: 10px 12px; }
.sk-mock-facebook .sk-mock-domain { font-size: 10px; color: #65676b; text-transform: uppercase; letter-spacing: 0.03em; }
.sk-mock-facebook .sk-mock-title { font-size: 13px; color: #050505; }
.sk-mock-facebook .sk-mock-desc { font-size: 11.5px; color: #65676b; }

.sk-mock-x { background: #ffffff; border: 1px solid #cfd9de; border-radius: 16px; }
.sk-mock-x .sk-mock-body { padding: 10px 12px; }
.sk-mock-x .sk-mock-title { font-size: 13px; color: #0f1419; }
.sk-mock-x .sk-mock-domain { font-size: 11px; color: #536471; margin-top: 1px; }

.sk-mock-linkedin { background: #ffffff; border: 1px solid #e6e9ec; border-radius: 3px; }
.sk-mock-linkedin .sk-mock-body { padding: 10px 12px; }
.sk-mock-linkedin .sk-mock-title { font-size: 13px; color: rgba(0,0,0,0.88); }
.sk-mock-linkedin .sk-mock-domain { font-size: 11px; color: rgba(0,0,0,0.6); margin-top: 2px; }

.sk-mock-whatsapp { background: transparent; padding: 6px; }
.sk-mock-whatsapp .sk-mock-bubble { display: flex; background: #dcf8c6; border-radius: 8px; overflow: hidden; }
.sk-mock-whatsapp .sk-mock-media { width: 64px; height: 64px; flex: none; aspect-ratio: auto; }
.sk-mock-whatsapp .sk-mock-body { padding: 8px 10px; justify-content: center; gap: 2px; }
.sk-mock-whatsapp .sk-mock-title { font-size: 12.5px; color: #111b21; }
.sk-mock-whatsapp .sk-mock-domain { font-size: 10.5px; color: #667781; }

.sk-mock-discord { background: #2b2d31; display: flex; border-radius: 6px; }
.sk-mock-discord .sk-mock-accent { width: 4px; flex: none; background: #5865f2; }
.sk-mock-discord .sk-mock-embed { padding: 10px 12px; display: flex; flex-direction: column; gap: 5px; flex: 1; min-width: 0; }
.sk-mock-discord .sk-mock-domain { font-size: 10.5px; color: #949ba4; }
.sk-mock-discord .sk-mock-title { font-size: 13px; color: #00aff4; font-weight: 700; }
.sk-mock-discord .sk-mock-desc { font-size: 11.5px; color: #dbdee1; -webkit-line-clamp: 3; }
.sk-mock-discord .sk-mock-media { margin-top: 4px; border-radius: 4px; max-width: 260px; }

.sk-clear { display: flex; align-items: center; gap: 9px; padding: 18px 4px; color: var(--normal); font-size: 12.5px; font-weight: 600; }
.sk-clear.is-loading { color: var(--text-3); }
.sk-clear.is-loading svg { animation: sk-breathe 1.25s ease-in-out infinite; }

.sk-docs {
  display: flex; align-items: center; gap: 6px;
  align-self: flex-start;
  font-size: 11.5px; font-weight: 600;
  color: var(--text-2); text-decoration: none;
  padding: 8px 12px; border-radius: var(--r-sm);
  border: 1px solid var(--line); background: var(--panel);
  transition: color 140ms ease, border-color 140ms ease;
}
.sk-linkrow { display: flex; gap: 8px; flex-wrap: wrap; }

/* ============ Tab bar ============ */

.sk-tabbar {
  position: relative; /* anchors .sk-tab-indicator */
  flex: none;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
  gap: 2px;
  padding: 8px 8px 10px;
  border-top: 1px solid var(--line);
}
/* A slim traveling underline, not a filled chip — it replaces the segment of
   the tab bar's own border-top above the active tab, the same way a browser
   or document tab bar shows which page a strip of content belongs to. Only
   the geometry changed from the first version (which used a full rounded
   box here); the travel itself — one element sliding via --tab-count/
   --active-index rather than N background swaps — is unchanged. */
.sk-tab-indicator {
  position: absolute;
  top: -1px;
  left: 8px;
  height: 2px;
  width: calc((100% - 16px - (var(--tab-count, 1) - 1) * 2px) / var(--tab-count, 1));
  transform: translateX(calc(var(--active-index, 0) * (100% + 2px)));
  background: var(--text);
  border-radius: 0 0 2px 2px;
  transition: transform 320ms cubic-bezier(0.16, 1, 0.3, 1);
}
.sk-tab {
  position: relative;
  z-index: 1;
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  min-width: 0; /* grid items don't shrink past their content's intrinsic
    width by default — without this the label below forces the whole
    track wider than its column instead of eliding. */
  padding: 6px 2px 5px;
  border-radius: 10px;
  color: var(--text-3);
  transition: color 140ms ease, background 140ms ease;
}
.sk-tab.is-active { color: var(--text); }
.sk-tab-icon { position: relative; display: grid; place-items: center; }
.sk-tab-dot {
  position: absolute; top: -2px; right: -4px;
  width: 6px; height: 6px; border-radius: 50%;
  border: 1.5px solid var(--chassis);
}
.sk-tab-dot.is-critical { background: var(--critical); }
.sk-tab-dot.is-warning { background: var(--warning); }
.sk-tab-label {
  max-width: 100%;
  font-size: 9px; font-weight: 600; letter-spacing: 0.02em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

/* ============ Adaptive ============ */

.sk-panel[data-sheet] { border-radius: 22px; }
.sk-panel[data-sheet] .sk-tab-label { font-size: 9.5px; }

@media (max-width: 620px) {
  .sk-launcher[data-side='right'] { right: 14px; }
  .sk-launcher[data-side='left'] { left: 14px; }
  .sk-tilegrid { grid-template-columns: 1fr 1fr; }
}

/* ============ Pointer capability ============ */

/* Hover styling only for input that can actually leave a hover state —
   otherwise a touch tap "hovers" the element until the next tap lands
   elsewhere, leaving a stuck highlight. This matters more than usual here:
   below 620px this panel *is* the touch UI (bottom sheet), not a fallback. */
@media (hover: hover) and (pointer: fine) {
  .sk-iconbtn:hover { background: var(--panel-3); color: var(--text); }
  .sk-tile:hover { background: var(--panel-2); border-color: var(--line-2); }
  .sk-subtab:hover { color: var(--text-2); }
  .sk-docs:hover { color: var(--text); border-color: var(--line-2); }
  .sk-tab:hover { color: var(--text-2); background: var(--panel-2); }
  .sk-path.is-actionable:hover { border-color: var(--normal); color: var(--normal); background: var(--normal-dim); }
}

/* ============ Accessibility preferences ============ */

@media (prefers-reduced-motion: reduce) {
  .sk-bubble { transition: opacity 140ms ease, transform 1ms linear; }
  .sk-panel { animation: sk-fade-in 160ms ease both; }
  .sk-panel[data-closing] { animation: sk-fade-out 120ms ease both; }
  .sk-ball, .sk-tile, .sk-path.is-actionable, .sk-tab-indicator { transition: none; }
  .sk-ball[data-scanning] .sk-ball-face { animation: none; opacity: 0.7; }
  .sk-ball[data-expanded] { transform: none; }
  .sk-clear.is-loading svg { animation: none; opacity: 0.7; }
  .sk-section { animation: none; }
}
@keyframes sk-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes sk-fade-out { from { opacity: 1; } to { opacity: 0; } }

@media (prefers-reduced-transparency: reduce) {
  .sk-panel, .sk-ball, .sk-bubble, .sk-ball-label {
    background: var(--chassis);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}

@media (prefers-contrast: more) {
  :host { --line: rgba(255,255,255,0.24); --line-2: rgba(255,255,255,0.4); --text-2: #cfdedb; --text-3: #a9bfba; }
  /* var(--chassis), not a literal: this must resolve to whichever theme is
     active, or a light-mode + high-contrast user gets a forced dark panel. */
  .sk-panel, .sk-ball, .sk-bubble { background: var(--chassis); backdrop-filter: none; -webkit-backdrop-filter: none; }
}
@media (prefers-color-scheme: light) and (prefers-contrast: more) {
  :host { --line: rgba(13,26,22,0.32); --line-2: rgba(13,26,22,0.5); --text-2: #1c2e28; --text-3: #16241f; }
}
`;
