import { useEffect, useState } from 'preact/hooks';
import { SanityLauncher } from './SanityLauncher';
import { PhonePanel } from './PhonePanel';
import { clampBallTop, BALL, type Side } from '../lib/geometry';
import { prefersReducedMotion } from '../lib/spring';
import { ScanContext, useScanState } from '../lib/scanContext';
import type { SectionId } from '../data/types';

type Phase = 'scanning' | 'idle' | 'fan' | 'panel';

// Matches .sk-panel[data-closing]'s exit-animation duration in panel.css.ts,
// so the panel unmounts exactly as its close animation finishes instead of
// popping away mid-flight.
const PANEL_CLOSE_MS = 180;
const PANEL_CLOSE_MS_REDUCED = 120;

export function App({ autoOpen = false }: { autoOpen?: boolean } = {}) {
  const scan = useScanState();
  // When Sanity is lazily mounted by the very Sidekick click that's asking
  // for it (see plugin-entry.ts's exported mount()), that click event is
  // long gone by the time this component's own custom:sanity listener
  // below gets attached — so the panel has to start open on purpose here,
  // rather than waiting for an event that already fired. Sections already
  // render a Loading fallback while the scan is still in flight, so opening
  // straight into 'panel' before the scan resolves is safe.
  const [phase, setPhase] = useState<Phase>(autoOpen ? 'panel' : 'scanning');
  const [active, setActive] = useState<SectionId>('summary');
  const [closingPanel, setClosingPanel] = useState(false);
  const [pos, setPos] = useState<{ side: Side; top: number }>(() => ({
    side: 'right',
    // Docked mid-edge so the fan-out opens as a symmetric arc by default,
    // instead of being tilted up against the bottom of the viewport.
    top: clampBallTop(Math.round(window.innerHeight * 0.5 - BALL / 2), window.innerHeight),
  }));

  // The ball leaves its scanning state once the real scan resolves, not on
  // a fixed timer — a fast page clears quickly, a slower one (broken-link
  // checks, header fetches) keeps the pulse going until it's actually done.
  useEffect(() => {
    if (scan.status === 'done') setPhase((p) => (p === 'scanning' ? 'idle' : p));
  }, [scan.status]);

  useEffect(() => {
    const onTrigger = () =>
      setPhase((p) => {
        if (p !== 'panel') return 'panel';
        setClosingPanel(true);
        return p; // stays 'panel' through the exit animation; see the effect below
      });

    // Per aem.live's sidekick-development docs, an event-type plugin's
    // custom:<id> event is dispatched on the <aem-sidekick> element itself
    // — not document, not window — so the listener has to target that
    // element specifically. Sidekick may not have initialized yet by the
    // time this runs, hence the sidekick-ready fallback (same pattern the
    // docs show).
    let sidekickEl: Element | null = null;
    const attach = (el: Element) => {
      sidekickEl = el;
      el.addEventListener('custom:sanity', onTrigger);
    };

    const existing = document.querySelector('aem-sidekick');
    if (existing) {
      attach(existing);
    } else {
      document.addEventListener(
        'sidekick-ready',
        () => {
          const el = document.querySelector('aem-sidekick');
          if (el) attach(el);
        },
        { once: true },
      );
    }

    return () => sidekickEl?.removeEventListener('custom:sanity', onTrigger);
  }, []);

  // Defers the actual unmount until the CSS close animation has had time to
  // play — without this the panel would just disappear instantly on close.
  useEffect(() => {
    if (!closingPanel) return;
    const ms = prefersReducedMotion() ? PANEL_CLOSE_MS_REDUCED : PANEL_CLOSE_MS;
    const timer = setTimeout(() => {
      setClosingPanel(false);
      setPhase('idle');
    }, ms);
    return () => clearTimeout(timer);
  }, [closingPanel]);

  function openSection(id: SectionId) {
    setActive(id);
    setClosingPanel(false);
    setPhase('panel');
  }

  function closePanel() {
    setClosingPanel(true);
  }

  return (
    <ScanContext.Provider value={scan}>
      <div class="sk-root">
        <SanityLauncher
          side={pos.side}
          top={pos.top}
          expanded={phase === 'fan'}
          scanning={phase === 'scanning'}
          hidden={phase === 'panel'}
          onExpandedChange={(next) => setPhase(next ? 'fan' : 'idle')}
          onSelect={openSection}
          onPositionChange={setPos}
        />
        {phase === 'panel' && (
          <PhonePanel
            side={pos.side}
            ballTop={pos.top}
            active={active}
            closing={closingPanel}
            onSelectSection={setActive}
            onClose={closePanel}
          />
        )}
      </div>
    </ScanContext.Provider>
  );
}
