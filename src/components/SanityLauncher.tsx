import { useEffect, useRef, useState } from 'preact/hooks';
import { buildSectionDefs } from '../data/sections';
import { useScan } from '../lib/scanContext';
import type { SectionId } from '../data/types';
import { PulseIcon } from './icons';
import { Spring, VelocityTracker, projectMomentum, rubberband } from '../lib/spring';
import { clusterLayout, clampBallTop, bubbleSize, BALL, type Side } from '../lib/geometry';

interface Props {
  side: Side;
  top: number;
  expanded: boolean;
  scanning: boolean;
  hidden: boolean;
  onExpandedChange: (next: boolean) => void;
  onSelect: (id: SectionId) => void;
  onPositionChange: (pos: { side: Side; top: number }) => void;
}

const HOVER_CLOSE_MS = 280;
const DRAG_THRESHOLD = 6;

export function SanityLauncher({
  side,
  top,
  expanded,
  scanning,
  hidden,
  onExpandedChange,
  onSelect,
  onPositionChange,
}: Props) {
  const scan = useScan();
  const sectionDefs = buildSectionDefs(scan.result);
  const overallSeverity = scan.result?.overallSeverity ?? 'idle';
  const badge = scan.result ? scan.result.criticalCount || scan.result.warningCount : 0;
  // The label lives on the ball, not the bubble under the cursor: in a
  // packed cluster there is no clear space beside a bubble to put one, and
  // a single stable position reads more easily than six cramped ones.
  const [hoveredId, setHoveredId] = useState<SectionId | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();

  const ySpring = useRef<Spring>();
  const xSpring = useRef<Spring>();
  const tracker = useRef(new VelocityTracker());
  const drag = useRef({ active: false, moved: false, grabDy: 0, startX: 0, startY: 0, rawTop: top });
  // X and Y are independent springs; a single spring on 2D distance desyncs
  // when the two axes carry different velocities.
  const liveSide = useRef<Side>(side);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    ySpring.current = new Spring(top, (v) => {
      el.style.setProperty('--ball-y', `${v}px`);
    }, { damping: 1, response: 0.4 });
    xSpring.current = new Spring(0, (v) => {
      el.style.setProperty('--ball-x', `${v}px`);
    }, { damping: 0.8, response: 0.35 });
    el.style.setProperty('--ball-y', `${top}px`);
    el.style.setProperty('--ball-x', '0px');
    return () => {
      ySpring.current?.stop();
      xSpring.current?.stop();
    };
    // Springs own the live value from here; `top` only seeds the initial frame.
  }, []);

  useEffect(() => {
    liveSide.current = side;
  }, [side]);

  // Keep the ball on screen when the viewport changes under it.
  useEffect(() => {
    const onResize = () => {
      const next = clampBallTop(drag.current.rawTop, window.innerHeight);
      drag.current.rawTop = next;
      ySpring.current?.set(next);
      onPositionChange({ side: liveSide.current, top: next });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [onPositionChange]);

  function cancelClose() {
    clearTimeout(closeTimer.current);
  }
  function scheduleClose() {
    cancelClose();
    closeTimer.current = setTimeout(() => onExpandedChange(false), HOVER_CLOSE_MS);
  }

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    drag.current = {
      active: true,
      moved: false,
      // Respect where the ball was grabbed, so it does not jump to the cursor.
      grabDy: e.clientY - rect.top,
      startX: e.clientX,
      startY: e.clientY,
      rawTop: rect.top,
    };
    tracker.current.clear();
    tracker.current.add(e.clientY);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* synthetic events have no live pointer to capture; drag still tracks */
    }
  }

  function onPointerMove(e: PointerEvent) {
    const d = drag.current;
    if (!d.active) return;
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < DRAG_THRESHOLD) return;
    d.moved = true;

    tracker.current.add(e.clientY);
    const desired = e.clientY - d.grabDy;
    const min = 12;
    const max = window.innerHeight - BALL - 12;

    // Resist past the edges instead of clamping dead.
    let next = desired;
    if (desired < min) next = min - rubberband(min - desired, window.innerHeight);
    else if (desired > max) next = max + rubberband(desired - max, window.innerHeight);

    d.rawTop = next;
    ySpring.current?.jump(next);

    const nextSide: Side = e.clientX < window.innerWidth / 2 ? 'left' : 'right';
    if (nextSide !== liveSide.current) {
      liveSide.current = nextSide;
      onPositionChange({ side: nextSide, top: next });
    }
  }

  function onPointerUp(e: PointerEvent) {
    const d = drag.current;
    if (!d.active) return;
    d.active = false;

    if (!d.moved) {
      onExpandedChange(!expanded);
      return;
    }

    // Land where the flick was actually going, then hand the spring the
    // release velocity so there is no seam between drag and animation.
    const velocity = tracker.current.velocity;
    const projected = d.rawTop + projectMomentum(velocity);
    const settled = clampBallTop(projected, window.innerHeight);
    d.rawTop = settled;
    ySpring.current?.set(settled, velocity);

    const finalSide: Side = e.clientX < window.innerWidth / 2 ? 'left' : 'right';
    liveSide.current = finalSide;
    onPositionChange({ side: finalSide, top: settled });
  }

  const fan = clusterLayout(sectionDefs.length, side, drag.current.rawTop, window.innerHeight, window.innerWidth);
  const bubblePx = bubbleSize(window.innerWidth);
  const hoveredLabel = hoveredId && sectionDefs.find((s) => s.id === hoveredId)?.label;
  // Flip below the ball when there isn't room above for the label to sit,
  // the same edge problem the cluster itself resists.
  const labelBelow = drag.current.rawTop < 52;

  return (
    <div
      ref={wrapRef}
      class="sk-launcher"
      data-side={side}
      data-hidden={hidden || undefined}
      onMouseEnter={cancelClose}
      onMouseLeave={() => expanded && scheduleClose()}
    >
      <div class="sk-fan" role="menu" aria-hidden={!expanded} data-open={expanded || undefined}>
        {sectionDefs.map((s, i) => {
          const { dx, dy } = fan[i];
          return (
            <button
              key={s.id}
              type="button"
              role="menuitem"
              tabIndex={expanded ? 0 : -1}
              class={`sk-bubble is-${s.severity}`}
              style={{
                '--dx': `${dx}px`,
                '--dy': `${dy}px`,
                '--bubble': `${bubblePx}px`,
              } as Record<string, string>}
              onClick={() => onSelect(s.id)}
              onMouseEnter={() => setHoveredId(s.id)}
              onMouseLeave={() => setHoveredId((h) => (h === s.id ? null : h))}
              onFocus={() => setHoveredId(s.id)}
              onBlur={() => setHoveredId((h) => (h === s.id ? null : h))}
            >
              <s.Icon size={18} />
              {s.issueCount > 0 && <span class="sk-bubble-badge">{s.issueCount}</span>}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        class={`sk-ball is-${scanning ? 'idle' : overallSeverity}`}
        data-expanded={expanded || undefined}
        data-scanning={scanning || undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onMouseEnter={() => !expanded && !scanning && onExpandedChange(true)}
        aria-label={scanning ? 'Sanity, scanning page' : `Sanity, ${badge} issues found`}
        aria-expanded={expanded}
        aria-haspopup="menu"
      >
        <span class="sk-ball-face">
          <PulseIcon size={21} />
        </span>
        {!scanning && badge > 0 && <span class="sk-ball-badge">{badge}</span>}
      </button>

      <span
        class={`sk-ball-label${hoveredLabel ? ' is-visible' : ''}${labelBelow ? ' is-below' : ''}`}
        aria-hidden="true"
      >
        {hoveredLabel || ''}
      </span>
    </div>
  );
}
