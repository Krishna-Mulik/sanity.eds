import { describe, it, expect } from 'vitest';
import { evaluateRuntimeErrors, type RuntimeErrorEntry } from './runtimeErrors';

describe('evaluateRuntimeErrors', () => {
  it('maps a resource failure to a finding pointing at the element', () => {
    const entries: RuntimeErrorEntry[] = [
      { message: 'Failed to load img: /broken.png', kind: 'resource', timestamp: 1, selector: 'img.hero' },
    ];
    const findings = evaluateRuntimeErrors(entries);
    expect(findings[0].title).toBe('Resource failed to load');
    expect(findings[0].targetSelector).toBe('img.hero');
    expect(findings[0].severity).toBe('critical');
  });

  it('maps a script error and an unhandled rejection to distinct titles', () => {
    const entries: RuntimeErrorEntry[] = [
      { message: 'x is not defined', kind: 'script', timestamp: 1 },
      { message: 'Unhandled promise rejection: Error: boom', kind: 'unhandledrejection', timestamp: 2 },
    ];
    const findings = evaluateRuntimeErrors(entries);
    expect(findings[0].title).toBe('Script error');
    expect(findings[1].title).toBe('Unhandled promise rejection');
  });

  it('produces unique ids for repeated errors of the same kind', () => {
    const entries: RuntimeErrorEntry[] = [
      { message: 'a', kind: 'script', timestamp: 1 },
      { message: 'b', kind: 'script', timestamp: 1 },
    ];
    const [a, b] = evaluateRuntimeErrors(entries);
    expect(a.id).not.toBe(b.id);
  });
});
