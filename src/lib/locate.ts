import { SEVERITY_COLOR, type Severity } from './severity';

const STYLE_ID = 'sanity-locate-style';

function ensureHighlightStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes sanity-locate-pulse {
      0% { box-shadow: 0 0 0 0 var(--sanity-locate-color); }
      70% { box-shadow: 0 0 0 10px transparent; }
      100% { box-shadow: 0 0 0 0 transparent; }
    }
    .sanity-locate-highlight {
      outline: 3px solid var(--sanity-locate-color) !important;
      outline-offset: 3px !important;
      animation: sanity-locate-pulse 1.1s ease-out 2 !important;
      transition: outline-color 0.2s ease !important;
    }
  `;
  document.head.appendChild(style);
}

let clearTimer: ReturnType<typeof setTimeout> | undefined;
let activeEl: HTMLElement | null = null;

export function locateOnPage(selector: string, severity: Severity): boolean {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return false;

  ensureHighlightStyle();

  if (activeEl) {
    activeEl.classList.remove('sanity-locate-highlight');
    activeEl.style.removeProperty('--sanity-locate-color');
  }
  if (clearTimer) clearTimeout(clearTimer);

  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.style.setProperty('--sanity-locate-color', SEVERITY_COLOR[severity]);
  el.classList.add('sanity-locate-highlight');
  activeEl = el;

  clearTimer = setTimeout(() => {
    el.classList.remove('sanity-locate-highlight');
    el.style.removeProperty('--sanity-locate-color');
    activeEl = null;
  }, 2400);

  return true;
}
