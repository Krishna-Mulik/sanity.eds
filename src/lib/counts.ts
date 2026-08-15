import type { Severity } from './severity';

export function describeCounts(items: { severity: Severity }[]): string {
  const critical = items.filter((i) => i.severity === 'critical').length;
  const warning = items.filter((i) => i.severity === 'warning').length;
  if (critical === 0 && warning === 0) return 'All clear';
  const parts: string[] = [];
  if (critical) parts.push(`${critical} critical`);
  if (warning) parts.push(`${warning} warning${warning > 1 ? 's' : ''}`);
  return parts.join(', ');
}
