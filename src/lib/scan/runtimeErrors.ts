// Console/script error and failed-resource capture. Must be installed at
// mount time, before the scan runs, since there is no way to retroactively
// see errors that fired before Sanity was on the page — that gap is a real
// limitation of an in-page plugin, not a bug here.
import type { Finding } from '../../data/types';
import { buildSelector } from '../selector';

export interface RuntimeErrorEntry {
  message: string;
  source?: string;
  kind: 'script' | 'unhandledrejection' | 'resource';
  timestamp: number;
  selector?: string;
}

const MAX_ENTRIES = 50;
let buffer: RuntimeErrorEntry[] = [];
let installed = false;

function push(entry: RuntimeErrorEntry) {
  buffer.push(entry);
  if (buffer.length > MAX_ENTRIES) buffer.shift();
}

export function installRuntimeErrorCapture(win: Window = window) {
  if (installed) return;
  installed = true;

  win.addEventListener(
    'error',
    (event) => {
      const target = event.target;
      if (target instanceof Element && target !== (win as unknown as Element)) {
        const src = (target as HTMLImageElement | HTMLScriptElement).src || (target as HTMLLinkElement).href || '';
        push({
          message: `Failed to load ${target.tagName.toLowerCase()}${src ? `: ${src}` : ''}`,
          kind: 'resource',
          timestamp: Date.now(),
          selector: buildSelector(target),
        });
        return;
      }
      push({
        message: event.message || 'Script error',
        source: event.filename,
        kind: 'script',
        timestamp: Date.now(),
      });
    },
    true,
  );

  win.addEventListener('unhandledrejection', (event) => {
    push({
      message: `Unhandled promise rejection: ${String(event.reason)}`,
      kind: 'unhandledrejection',
      timestamp: Date.now(),
    });
  });
}

export function getRuntimeErrors(): RuntimeErrorEntry[] {
  return [...buffer];
}

export function evaluateRuntimeErrors(entries: RuntimeErrorEntry[]): Finding[] {
  return entries.map((e, i) => ({
    id: `runtime-${e.kind}-${e.timestamp}-${i}`,
    title:
      e.kind === 'resource' ? 'Resource failed to load' : e.kind === 'unhandledrejection' ? 'Unhandled promise rejection' : 'Script error',
    detail: e.message,
    severity: 'critical',
    path: e.source,
    targetSelector: e.selector,
  }));
}
