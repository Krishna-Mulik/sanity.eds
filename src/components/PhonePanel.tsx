import { useEffect, useRef } from 'preact/hooks';
import { buildSectionDefs, sectionById } from '../data/sections';
import { useScan } from '../lib/scanContext';
import {
  SummarySection,
  PerformanceSection,
  SeoSection,
  SocialSection,
  SecuritySection,
  TechnicalSection,
  AccessibilitySection,
} from './sections';
import { CloseIcon } from './icons';
import { panelPlacement, type Side } from '../lib/geometry';
import type { SectionId } from '../data/types';

interface Props {
  side: Side;
  ballTop: number;
  active: SectionId;
  onSelectSection: (id: SectionId) => void;
  onClose: () => void;
}

export function PhonePanel({ side, ballTop, active, onSelectSection, onClose }: Props) {
  const scan = useScan();
  const sectionDefs = buildSectionDefs(scan.result);
  const current = sectionById(sectionDefs, active);
  const box = panelPlacement(side, ballTop, window.innerWidth, window.innerHeight);
  const screenRef = useRef<HTMLDivElement>(null);

  // Each section is its own page: always start it at the top.
  useEffect(() => {
    screenRef.current?.scrollTo({ top: 0 });
  }, [active]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Locating an element scrolls/highlights it on the host page behind the
  // panel; it must not also close the panel — the panel is a small floating
  // surface, not a full-screen sheet blocking the page underneath it.
  const props = { onLocate: () => {}, onSelectSection };

  return (
    <div
      class="sk-panel"
      role="dialog"
      aria-label={`Sanity — ${current.label}`}
      data-side={side}
      data-sheet={box.sheet || undefined}
      style={{
        width: `${box.width}px`,
        height: `${box.height}px`,
        top: `${box.top}px`,
        [side]: `${box.offset}px`,
        transformOrigin: `${box.originX} ${box.originY}`,
      } as Record<string, string>}
    >
      <header class="sk-panel-head">
        <div class="sk-panel-heading">
          <h2 class="sk-panel-title">{current.label}</h2>
          <span class={`sk-panel-status is-${current.severity}`}>{current.headerStatus}</span>
        </div>
        <button type="button" class="sk-iconbtn" onClick={onClose} aria-label="Close Sanity">
          <CloseIcon size={15} />
        </button>
      </header>

      <div class="sk-screen" ref={screenRef}>
        <div class="sk-section" key={active}>
          {active === 'summary' && <SummarySection {...props} />}
          {active === 'performance' && <PerformanceSection {...props} />}
          {active === 'seo' && <SeoSection {...props} />}
          {active === 'social' && <SocialSection {...props} />}
          {active === 'security' && <SecuritySection {...props} />}
          {active === 'technical' && <TechnicalSection {...props} />}
          {active === 'accessibility' && <AccessibilitySection {...props} />}
        </div>
      </div>

      <nav class="sk-tabbar" aria-label="Sections">
        {sectionDefs.map((s) => (
          <button
            key={s.id}
            type="button"
            class={`sk-tab${active === s.id ? ' is-active' : ''}`}
            onClick={() => onSelectSection(s.id)}
            aria-current={active === s.id ? 'page' : undefined}
          >
            <span class="sk-tab-icon">
              <s.Icon size={17} />
              {s.issueCount > 0 && s.id !== 'summary' && <span class={`sk-tab-dot is-${s.severity}`} />}
            </span>
            <span class="sk-tab-label">{s.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
