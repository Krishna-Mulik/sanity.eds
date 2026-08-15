// Minimal spring integrator using Apple's designer-facing parameters
// (damping ratio + response) rather than mass/stiffness/damping.
//
//   damping  1.0 = critically damped, no overshoot;  <1 overshoots
//   response      seconds to reach the target; lower = snappier
//
// Springs (not CSS transitions) because every motion here is grabbable:
// the value always animates from its current on-screen position and can be
// re-targeted mid-flight, carrying its velocity through, so an interrupted
// drag never jumps or hits a velocity "brick wall".

export interface SpringOpts {
  damping?: number;
  response?: number;
}

const REST_DISTANCE = 0.05;
const REST_VELOCITY = 0.05;
const MAX_FRAME = 1 / 30;
const SUBSTEP = 1 / 240;

export class Spring {
  private x: number;
  private v = 0;
  private goal: number;
  private zeta!: number;
  private omega!: number;
  private raf = 0;
  private last = 0;
  private onChange: (value: number) => void;

  constructor(initial: number, onChange: (value: number) => void, opts: SpringOpts = {}) {
    this.x = initial;
    this.goal = initial;
    this.onChange = onChange;
    this.configure(opts);
  }

  configure({ damping = 1, response = 0.4 }: SpringOpts) {
    this.zeta = damping;
    this.omega = (2 * Math.PI) / response;
  }

  get value() {
    return this.x;
  }
  get velocity() {
    return this.v;
  }
  get target() {
    return this.goal;
  }

  /** Re-target. Velocity is preserved unless explicitly handed a new one. */
  set(target: number, velocity?: number) {
    this.goal = target;
    if (velocity !== undefined) this.v = velocity;
    this.start();
  }

  /** Snap with no animation (e.g. 1:1 drag tracking). */
  jump(value: number, velocity = 0) {
    this.stop();
    this.x = value;
    this.goal = value;
    this.v = velocity;
    this.onChange(this.x);
  }

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.last = 0;
  }

  private start() {
    if (this.raf) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (now: number) => {
    this.raf = 0;
    const frame = Math.min((now - this.last) / 1000, MAX_FRAME);
    this.last = now;

    // Fixed substeps keep the integration stable at any frame rate.
    let remaining = frame;
    const k = this.omega * this.omega;
    const c = 2 * this.zeta * this.omega;
    while (remaining > 0) {
      const dt = Math.min(remaining, SUBSTEP);
      const a = -k * (this.x - this.goal) - c * this.v;
      this.v += a * dt;
      this.x += this.v * dt;
      remaining -= dt;
    }

    if (Math.abs(this.x - this.goal) < REST_DISTANCE && Math.abs(this.v) < REST_VELOCITY) {
      this.x = this.goal;
      this.v = 0;
      this.onChange(this.x);
      return;
    }

    this.onChange(this.x);
    this.raf = requestAnimationFrame(this.tick);
  };
}

/**
 * Where a flick would come to rest, using the exponential-decay projection
 * Apple ships in Designing Fluid Interfaces (not the v²/2a textbook form).
 */
export function projectMomentum(velocity: number, decelerationRate = 0.998) {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Progressive resistance past a boundary, so edges resist instead of clamping dead. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/** Tracks recent pointer samples so release velocity reflects the last ~80ms, not one frame. */
export class VelocityTracker {
  private samples: { t: number; v: number }[] = [];

  add(value: number, time = performance.now()) {
    this.samples.push({ t: time, v: value });
    while (this.samples.length > 6) this.samples.shift();
  }

  clear() {
    this.samples = [];
  }

  /** px per second */
  get velocity() {
    if (this.samples.length < 2) return 0;
    const last = this.samples[this.samples.length - 1];
    let first = this.samples[0];
    for (const s of this.samples) {
      if (last.t - s.t <= 80) {
        first = s;
        break;
      }
    }
    const dt = (last.t - first.t) / 1000;
    if (dt <= 0) return 0;
    return (last.v - first.v) / dt;
  }
}

export const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
