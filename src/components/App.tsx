import { useEffect, useState } from 'preact/hooks';
import { SanityLauncher } from './SanityLauncher';
import { PhonePanel } from './PhonePanel';
import { clampBallTop, BALL, type Side } from '../lib/geometry';
import { ScanContext, useScanState } from '../lib/scanContext';
import type { SectionId } from '../data/types';

type Phase = 'scanning' | 'idle' | 'fan' | 'panel';

export function App() {
  const scan = useScanState();
  const [phase, setPhase] = useState<Phase>('scanning');
  const [active, setActive] = useState<SectionId>('summary');
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
    const onTrigger = () => setPhase((p) => (p === 'panel' ? 'idle' : 'panel'));
    window.addEventListener('custom:sanity', onTrigger);
    return () => window.removeEventListener('custom:sanity', onTrigger);
  }, []);

  function openSection(id: SectionId) {
    setActive(id);
    setPhase('panel');
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
            onSelectSection={setActive}
            onClose={() => setPhase('idle')}
          />
        )}
      </div>
    </ScanContext.Provider>
  );
}
