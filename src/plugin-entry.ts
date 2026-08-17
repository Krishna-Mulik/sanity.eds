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

// Opt-in second entry point. mount() only ever runs for a visitor who is
// both a Sidekick user AND authorized on the site (Sidekick gates its
// entire toolbar, this plugin's button included, behind the Admin API
// recognizing the logged-in identity as a collaborator — see README's
// "Register the Sidekick plugin" section) — so an unauthorized teammate,
// or a showcase/demo site's own visitors, never see Sanity at all, even
// though the event-based path is wired up correctly.
//
// mountOnLoad() exists for exactly that case: a consumer's scripts.js can
// call this directly instead of (or alongside) the custom:sanity listener
// to mount Sanity for every visitor, no Sidekick or site authorization
// required. This is a deliberate, self-inflicted reversal of the
// zero-bytes-to-anonymous-visitors guarantee mount() otherwise provides —
// every visitor to a site that calls this downloads the full ~290KB gzip
// panel bundle, not just Sidekick users. It is never called by anything
// else in this file; a consumer has to reach for it on purpose. Reach for
// it on a demo/portfolio project that wants Sanity always visible, not on
// a real production EDS site, where that trade-off is exactly what mount()
// was built to avoid.
//
// Deferred until both the page's load event has fired AND its first LCP
// candidate has been reported, so this never competes with the page's own
// critical rendering path for bandwidth/main-thread time — it's additive
// UI chrome, not something a visitor's real Core Web Vitals should ever
// pay for.
export async function mountOnLoad() {
  if (mounted) return;
  await waitForLoadAndLcp();
  if (mounted) return; // a mount() call may have raced in during the wait
  mounted = true;
  const { initSanity } = await import('./lib/mount');
  initSanity({ autoOpen: false });
}

function waitForLoadAndLcp(): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve();
    };

    let loadSeen = document.readyState === 'complete';
    let lcpSeen = false;
    const check = () => {
      if (loadSeen && lcpSeen) finish();
    };

    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver(() => {
          // A page can keep revising its LCP entry as later, larger
          // content paints — reacting to the very first callback is
          // enough here, this is a "let real paint work go first" gate,
          // not a real LCP measurement (that's what performance.ts does).
          lcpSeen = true;
          observer.disconnect();
          check();
        });
        observer.observe({ type: 'largest-contentful-paint', buffered: true });
      } catch {
        // Unsupported browser — don't block forever on a signal that will
        // never arrive.
        lcpSeen = true;
      }
    } else {
      lcpSeen = true;
    }

    if (!loadSeen) {
      window.addEventListener(
        'load',
        () => {
          loadSeen = true;
          check();
        },
        { once: true },
      );
    }

    // A page with no qualifying LCP candidate at all (rare — e.g. an
    // essentially empty page) would otherwise wait forever; a hard ceiling
    // guarantees this always eventually mounts.
    const timeout = setTimeout(finish, 10000);

    check();
  });
}
