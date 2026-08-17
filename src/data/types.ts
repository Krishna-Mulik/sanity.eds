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
  /**
   * Overrides the badge text normally derived from `severity` (e.g. "Info"
   * instead of the default "Not checked" for `idle`) — for findings that
   * aren't really a "we tried and couldn't check" state, just a standing
   * informational note. Severity itself (and its color/rollup behavior)
   * is unchanged; only the label shown to the reader differs.
   */
  severityLabel?: string;
  /** Asset path or DOM location, shown as monospace text and used to locate. */
  path?: string;
  /** Selector on the host page, when the finding points at a real element. */
  targetSelector?: string;
  /**
   * When true, `path`'s control copies the full URL (origin + path) to the
   * clipboard instead of locating on the page — for findings about a
   * resource (a JSON file, say) that has no meaningful on-page element to
   * scroll to. Takes precedence over `targetSelector` if both are set.
   */
  copyable?: boolean;
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
export interface HeadingOutlineItem {
  level: number;
  text: string;
  selector: string;
}

export interface SeoPageInfo {
  url: string;
  canonicalHref: string | null;
  robotsContent: string | null;
  keywordsContent: string | null;
  authorContent: string | null;
  publisherContent: string | null;
  lang: string | null;
  /** Index 0 = H1 count ... index 5 = H6 count. */
  headingCounts: number[];
  /** Headings in document order, for rendering the outline (H1 > H2 > H4...) and flagging skipped levels. */
  headings: HeadingOutlineItem[];
  imageCount: number;
  /** Font families actually loaded for this render (CSS Font Loading API). */
  fontsUsed: string[];
  /** Images with no alt attribute at all, excluding ones marked decorative — same signal as axe-core's image-alt rule, shown here so the specific images are visible alongside the rest of the page's structure. */
  imagesMissingAlt: { selector: string; src: string }[];
}

/**
 * This page's URL alongside its counterpart on the other EDS environment
 * (.aem.page <-> .aem.live) — a plain hostname swap, no fetch involved (see
 * consistency.ts for why: cross-origin fetch is CORS-blocked on these hosts
 * for essentially every real site). `null` when the current host isn't a
 * recognized preview/live host at all.
 */
export interface ConsistencyUrls {
  currentUrl: string;
  currentHost: 'aem.page' | 'aem.live' | 'hlx.page' | 'hlx.live';
  counterpartUrl: string;
  counterpartHost: 'aem.page' | 'aem.live' | 'hlx.page' | 'hlx.live';
}

/** Everything one full scan produced, feeding every section of the panel. */
export interface ScanResult {
  performanceScore: number;
  /** Which device this scan's one CWV reading actually came from — see gatherFormFactor(). */
  formFactor: 'Mobile' | 'Desktop';
  cwv: Metric[];
  renderBlockers: RenderBlocker[];
  recommendations: string[];
  performanceFindings: Finding[];
  seoFindings: Finding[];
  seoPageInfo: SeoPageInfo;
  linkStats: LinkStats;
  /** Broken-link findings alone, for the Links tab's own list — also folded into seoFindings. */
  linkFindings: Finding[];
  socialFindings: Finding[];
  socialCards: SocialCard[];
  securityFindings: Finding[];
  limitFindings: Finding[];
  siteLimitFindings: Finding[];
  jsonSheetMetrics: Metric[];
  blockFindings: Finding[];
  /** eslint-plugin-xwalk's xwalk/max-cells rule, reimplemented against a live xwalk site's component-models.json — empty on non-xwalk sites. */
  maxCellsFindings: Finding[];
  accessibilityFindings: Finding[];
  consistencyUrls: ConsistencyUrls | null;
  siteInfo: SiteIdentity | null;
  sectionSeverity: Record<CheckedSectionId, Severity>;
  sectionBreakdown: Record<CheckedSectionId, { critical: number; warning: number }>;
  sectionIssueCount: Record<CheckedSectionId, number>;
  criticalCount: number;
  warningCount: number;
  overallSeverity: Severity;
}
