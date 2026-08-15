import type { JSX } from 'preact';
import { GridIcon, GaugeIcon, MagnifierIcon, ShareIcon, ShieldIcon, BracketsIcon, EyeIcon } from '../components/icons';
import type { CheckedSectionId, ScanResult, SectionId } from './types';
import type { Severity } from '../lib/severity';

export interface SectionDef {
  id: SectionId;
  label: string;
  Icon: (props: JSX.SVGAttributes<SVGSVGElement> & { size?: number }) => JSX.Element;
  severity: Severity;
  /** Badge count on the bubble and tab bar. */
  issueCount: number;
  /** Large numeral on the summary tile. */
  reading: string;
  /** Unit or qualifier sitting beside the reading on the summary row. */
  status: string;
  /** Severity breakdown shown under the title in the panel header. */
  headerStatus: string;
}

function issueLine(n: number) {
  if (n === 0) return 'No issues';
  return `${n} issue${n > 1 ? 's' : ''}`;
}

/** "2 critical, 1 warning" — the panel header's own subtitle. */
function breakdown(counts: { critical: number; warning: number }) {
  const parts: string[] = [];
  if (counts.critical) parts.push(`${counts.critical} critical`);
  if (counts.warning) parts.push(`${counts.warning} warning${counts.warning > 1 ? 's' : ''}`);
  return parts.join(', ') || 'All clear';
}

/**
 * Builds the section registry from a live scan result. `result` is null
 * while the first scan is still running (or, rarely, if the Sidekick
 * `custom:sanity` event opens the panel before that scan resolves) — every
 * reading falls back to an idle "Scanning…" placeholder rather than a stale
 * or fabricated number.
 */
export function buildSectionDefs(result: ScanResult | null): SectionDef[] {
  const sev = (id: CheckedSectionId): Severity => result?.sectionSeverity[id] ?? 'idle';
  const count = (id: CheckedSectionId): number => result?.sectionIssueCount[id] ?? 0;
  const brk = (id: CheckedSectionId) => result?.sectionBreakdown[id] ?? { critical: 0, warning: 0 };
  const header = (id: CheckedSectionId) => (result ? breakdown(brk(id)) : 'Scanning…');

  return [
    {
      id: 'summary',
      label: 'Summary',
      Icon: GridIcon,
      severity: result ? result.overallSeverity : 'idle',
      issueCount: result ? result.criticalCount || result.warningCount : 0,
      reading: result ? String(result.criticalCount + result.warningCount) : '–',
      status: 'to review',
      headerStatus: result ? breakdown({ critical: result.criticalCount, warning: result.warningCount }) : 'Scanning…',
    },
    {
      id: 'performance',
      label: 'Speed',
      Icon: GaugeIcon,
      severity: sev('performance'),
      issueCount: count('performance'),
      reading: result ? String(result.performanceScore) : '–',
      status: 'out of 100',
      headerStatus: header('performance'),
    },
    {
      id: 'seo',
      label: 'SEO',
      Icon: MagnifierIcon,
      severity: sev('seo'),
      issueCount: count('seo'),
      reading: String(count('seo')),
      status: issueLine(count('seo')),
      headerStatus: header('seo'),
    },
    {
      id: 'social',
      label: 'Social',
      Icon: ShareIcon,
      severity: sev('social'),
      issueCount: count('social'),
      reading: String(count('social')),
      status: 'tags to review',
      headerStatus: result ? `${count('social')} tag${count('social') === 1 ? '' : 's'} to review` : 'Scanning…',
    },
    {
      id: 'security',
      label: 'Security',
      Icon: ShieldIcon,
      severity: sev('security'),
      issueCount: count('security'),
      reading: String(count('security')),
      status: issueLine(count('security')),
      headerStatus: header('security'),
    },
    {
      id: 'technical',
      label: 'Technical',
      Icon: BracketsIcon,
      severity: sev('technical'),
      issueCount: count('technical'),
      reading: String(count('technical')),
      status: issueLine(count('technical')),
      headerStatus: header('technical'),
    },
    {
      id: 'accessibility',
      label: 'Accessibility',
      Icon: EyeIcon,
      severity: sev('accessibility'),
      issueCount: count('accessibility'),
      reading: String(count('accessibility')),
      status: issueLine(count('accessibility')),
      headerStatus: header('accessibility'),
    },
  ];
}

export const sectionById = (defs: SectionDef[], id: SectionId) => defs.find((s) => s.id === id)!;
