// Distributable entry point (see vite.plugin.config.ts / README.md).
//
// Deliberately does NOT import src/main.tsx, which also imports
// src/index.css — that stylesheet is the mock Cairn Supply Co. dev harness
// page, not the plugin, and must never ship inside dist-plugin.
//
// Split into two pieces on purpose:
//  - installRuntimeErrorCapture() is dependency-free (no Preact, no
//    axe-core) and runs eagerly the moment this module is imported, so it's
//    watching for errors from page load — before anyone has clicked
//    anything.
//  - The actual panel UI (Preact + axe-core + every scan module, ~290KB
//    gzip) is NOT imported here. It's only pulled in — as a genuinely
//    separate network chunk, via the dynamic import() below — when mount()
//    is actually called, i.e. when a Sidekick user clicks the Sanity
//    plugin button. A regular site visitor who never opens Sidekick never
//    downloads it and never sees the floating ball.
import { installRuntimeErrorCapture } from './lib/scan/runtimeErrors';

installRuntimeErrorCapture();

let mounted = false;

// Matches the call signature aem.live's sidekick-development docs show for
// an event-type plugin's handler: `({ detail }) => ...`. `detail` isn't
// used today (Sanity re-scans the live page itself rather than trusting
// Sidekick's injected state) but is accepted so a consumer can pass
// `event.detail` straight through without checking.
export async function mount(_detail?: unknown) {
  if (mounted) return;
  mounted = true;
  const { initSanity } = await import('./lib/mount');
  initSanity({ autoOpen: true });
}
