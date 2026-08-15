export type Severity = 'critical' | 'warning' | 'normal' | 'idle';

// Hex twins of the tokens in tokens.css.ts. Duplicated deliberately: these
// values are also used to style highlights on the *host page* (light DOM,
// outside the shadow root), where CSS custom properties from :host don't
// reach.
export const SEVERITY_COLOR: Record<Severity, string> = {
  critical: '#f2554b',
  warning: '#ecb148',
  normal: '#37c986',
  idle: '#6c8981',
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: 'Critical',
  warning: 'Warning',
  normal: 'Normal',
  idle: 'Not checked',
};

export function worstSeverity(list: Severity[]): Severity {
  if (list.includes('critical')) return 'critical';
  if (list.includes('warning')) return 'warning';
  if (list.some((s) => s === 'normal')) return 'normal';
  return 'idle';
}
