import type { Severity } from '../lib/severity';

export type SectionId = 'summary' | 'performance' | 'seo' | 'social' | 'security' | 'technical' | 'accessibility';

/** The section ids that carry their own findings/severity (everything but the summary rollup). */
export type CheckedSectionId = Exclude<SectionId, 'summary'>;

/**
 * One check result. Findings render flat and fully expanded — never behind an
 * accordion — so everything wrong with the page is readable in one pass.
 */
export interface Finding {
  id: string;
  title: string;
  /** One line of plain language: what is wrong and why it matters. */
  detail: string;
  severity: Severity;
  /** Asset path or DOM location, shown as monospace text and used to locate. */
  path?: string;
  /** Selector on the host page, when the finding points at a real element. */
  targetSelector?: string;
  /** Measured vs allowed, for limit-style findings. */
  measured?: string;
  allowed?: string;
}

export interface Metric {
  id: string;
  label: string;
  value: string;
  target: string;
  severity: Severity;
}

export interface RenderBlocker {
  path: string;
  blockingMs: number;
  detail: string;
  severity: Severity;
}

export interface SocialCard {
  id: string;
  platform: string;
  title: string;
  description: string | null;
  imageSeed: string;
  /** Real resolved image URL, when the check could find one — falls back to the seed placeholder. */
  imageUrl?: string;
}

export interface LinkStats {
  total: number;
  unique: number;
  internal: number;
  external: number;
  missingTitle: number;
  broken: number;
  /** How many unique links were actually live-checked (capped for scan speed). */
  checked: number;
}

/** Read straight off the ref--repo--owner.aem.page/aem.live hostname — no API needed. */
export interface SiteIdentity {
  owner: string;
  repo: string;
  ref: string;
  host: string;
}

/**
 * Plain metadata overview — no pass/fail judgment attached. Title/description
 * already carry real severity as Findings; these (keywords/author/publisher/
 * lang/heading & image counts) have no honest pass/fail from a single page
 * (keywords meta is ignored by modern search engines either way; a missing
 * or invalid lang attribute is axe-core's html-has-lang/html-lang-valid
 * judgment to make, in the Accessibility section, not a second opinion here).
 */
export interface SeoPageInfo {
  url: string;
  robotsContent: string | null;
  keywordsContent: string | null;
  authorContent: string | null;
  publisherContent: string | null;
  lang: string | null;
  /** Index 0 = H1 count ... index 5 = H6 count. */
  headingCounts: number[];
  imageCount: number;
}

/** Everything one full scan produced, feeding every section of the panel. */
export interface ScanResult {
  performanceScore: number;
  cwv: Metric[];
  renderBlockers: RenderBlocker[];
  recommendations: string[];
  performanceFindings: Finding[];
  seoFindings: Finding[];
  seoPageInfo: SeoPageInfo;
  linkStats: LinkStats;
  socialFindings: Finding[];
  socialCards: SocialCard[];
  securityFindings: Finding[];
  limitFindings: Finding[];
  siteLimitFindings: Finding[];
  blockFindings: Finding[];
  consistencyFindings: Finding[];
  accessibilityFindings: Finding[];
  siteInfo: SiteIdentity | null;
  sectionSeverity: Record<CheckedSectionId, Severity>;
  sectionBreakdown: Record<CheckedSectionId, { critical: number; warning: number }>;
  sectionIssueCount: Record<CheckedSectionId, number>;
  criticalCount: number;
  warningCount: number;
  overallSeverity: Severity;
}
