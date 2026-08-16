import { render } from 'preact';
import { App } from '../components/App';
import { tokensCss } from './tokens.css';
import { panelCss } from './panel.css';
import { installRuntimeErrorCapture } from './scan/runtimeErrors';

// The ball is persistent chrome, like a real assistive-ball floating
// button: it mounts as soon as the host EDS site's scripts.js runs, inside
// its own Shadow DOM root — no iframe, no palette. The Sidekick "Sanity"
// button (a `custom:sanity` event dispatched on the <aem-sidekick> element,
// handled inside App) is just an additional way to open it; it does not
// gate whether the ball exists.
export function initSanity(options: { autoOpen?: boolean } = {}) {
  // Idempotent, so this is harmless even though plugin-entry.ts's eager
  // install already covers the real-world (lazy-mount) distribution path —
  // must install before the scan runs regardless, since there is no way to
  // retroactively see console/script/resource errors that fired before
  // Sanity was on the page.
  installRuntimeErrorCapture();

  const host = document.createElement('div');
  host.id = 'sanity-panel-host';
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = tokensCss + panelCss;
  shadow.appendChild(style);

  const container = document.createElement('div');
  shadow.appendChild(container);

  render(<App autoOpen={options.autoOpen} />, container);
}
