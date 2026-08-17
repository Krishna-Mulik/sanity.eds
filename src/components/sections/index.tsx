import { useState } from 'preact/hooks';
import { Block, FindingRow, MetricCell, AllClear, Loading, SeverityCounts, SubTabs } from '../blocks';
import { buildSectionDefs } from '../../data/sections';
import { useScan } from '../../lib/scanContext';
import type { SectionId, SocialCard, HeadingOutlineItem, ConsistencyUrls } from '../../data/types';
import { ChevronRightIcon, TargetIcon, CopyIcon } from '../icons';
import { locateOnPage } from '../../lib/locate';
import { scoreSeverity } from '../../lib/scan/performance';
import { relativizeUrl } from '../../lib/format';

interface SectionProps {
  onLocate: () => void;
  onSelectSection: (id: SectionId) => void;
}

/* ---------------- Summary ---------------- */

export function SummarySection({ onSelectSection }: SectionProps) {
  const { result } = useScan();
  if (!result) return <Loading label="Scanning the page…" />;

  const { criticalCount, warningCount } = result;
  const severity = criticalCount ? 'critical' : warningCount ? 'warning' : 'normal';
  const sectionDefs = buildSectionDefs(result);

  return (
    <>
      <div class={`sk-verdict is-${severity}`}>
        <div class="sk-verdict-counts">
          <span class="sk-verdict-num">{criticalCount}</span>
          <span class="sk-verdict-unit">critical</span>
          <span class="sk-verdict-div" />
          <span class="sk-verdict-num is-warning">{warningCount}</span>
          <span class="sk-verdict-unit">warnings</span>
        </div>
        <p class="sk-verdict-note">
          {criticalCount || warningCount ? 'Fix the critical findings before publishing.' : 'Nothing outstanding — nice page.'}
        </p>
      </div>

      {result.siteInfo && (
        <Block title="Site" meta={result.siteInfo.host}>
          <div class="sk-rows">
            <div class="sk-row">
              <div class="sk-row-main">
                <span class="sk-row-path">
                  {result.siteInfo.owner}/{result.siteInfo.repo}
                </span>
                <span class="sk-row-detail">ref: {result.siteInfo.ref}</span>
              </div>
            </div>
          </div>
        </Block>
      )}

      <Block title="Sections">
        <div class="sk-tilegrid">
          {sectionDefs
            .filter((s) => s.id !== 'summary')
            .map((s) => (
              <button key={s.id} type="button" class={`sk-tile is-${s.severity}`} onClick={() => onSelectSection(s.id)}>
                <span class="sk-tile-icon">
                  <s.Icon size={16} />
                </span>
                <span class="sk-tile-label">{s.label}</span>
                <span class="sk-tile-reading">{s.reading}</span>
                <span class="sk-tile-status">{s.status}</span>
              </button>
            ))}
        </div>
      </Block>
    </>
  );
}

/* ---------------- Performance ---------------- */

export function PerformanceSection({ onLocate }: SectionProps) {
  const { result } = useScan();
  if (!result) return <Loading label="Measuring performance…" />;

  const { performanceScore, formFactor, cwv, renderBlockers, recommendations, performanceFindings } = result;

  return (
    <>
      <div class={`sk-verdict is-${scoreSeverity(performanceScore)}`}>
        <div class="sk-score">
          <span class="sk-score-num">{performanceScore}</span>
          <span class="sk-score-unit">/100</span>
        </div>
        <p class="sk-verdict-note">
          {cwv.some((m) => m.severity === 'critical' || m.severity === 'warning')
            ? 'One or more Core Web Vitals are failing their thresholds.'
            : 'Core Web Vitals are within their thresholds.'}
        </p>
      </div>

      <Block title="Core Web Vitals" meta={`${formFactor} · this session`}>
        <div class="sk-metricgrid">
          {cwv.map((m) => (
            <MetricCell key={m.id} label={m.label} value={m.value} target={m.target} severity={m.severity} />
          ))}
        </div>
      </Block>

      {renderBlockers.length > 0 && (
        <Block title="Render blocking" meta={`${renderBlockers.length} resources`}>
          <div class="sk-rows">
            {renderBlockers.map((b) => (
              <div class={`sk-row is-${b.severity}`} key={b.path}>
                <div class="sk-row-main">
                  <span class="sk-row-path">{b.path}</span>
                  <span class="sk-row-detail">{b.detail}</span>
                </div>
                <span class="sk-row-value">+{b.blockingMs}ms</span>
              </div>
            ))}
          </div>
        </Block>
      )}

      {performanceFindings.length > 0 && (
        <Block title="Findings" meta={<SeverityCounts findings={performanceFindings} />}>
          <div class="sk-findings">
            {performanceFindings.map((f) => (
              <FindingRow finding={f} onLocate={onLocate} key={f.id} />
            ))}
          </div>
        </Block>
      )}

      {recommendations.length > 0 && (
        <Block title="Recommendations">
          <ol class="sk-reco">
            {recommendations.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ol>
        </Block>
      )}

      <div class="sk-linkrow">
        <a
          class="sk-docs"
          href={`https://pagespeed.web.dev/report?url=${encodeURIComponent(window.location.href)}&form_factor=mobile`}
          target="_blank"
          rel="noreferrer"
        >
          <span>PageSpeed Insights — Mobile</span>
          <ChevronRightIcon size={13} />
        </a>
        <a
          class="sk-docs"
          href={`https://pagespeed.web.dev/report?url=${encodeURIComponent(window.location.href)}&form_factor=desktop`}
          target="_blank"
          rel="noreferrer"
        >
          <span>PageSpeed Insights — Desktop</span>
          <ChevronRightIcon size={13} />
        </a>
        <a class="sk-docs" href={`https://www.webpagetest.org/?url=${encodeURIComponent(window.location.href)}`} target="_blank" rel="noreferrer">
          <span>Test with WebPageTest</span>
          <ChevronRightIcon size={13} />
        </a>
      </div>
    </>
  );
}

/* ---------------- SEO ---------------- */

const SEO_TABS = ['Findings', 'Metadata', 'Structure', 'Links', 'Preview vs Live'] as const;
type SeoTab = (typeof SEO_TABS)[number];

/**
 * Only the broken transitions (H3 straight to H5, skipping H4), not the
 * full document-order chain — the point is to point at the specific place
 * the outline skips a level, not to re-list every heading on the page. A
 * skip is only ever flagged going *deeper* (level jumps up by more than
 * one); returning to a shallower heading is always valid outline
 * structure, never an error. This is a visual aid, not a duplicate
 * finding: axe-core's heading-order rule (Accessibility section) already
 * owns the pass/fail verdict on this.
 */
function HeadingOutline({ headings, onLocate }: { headings: HeadingOutlineItem[]; onLocate?: () => void }) {
  const breaks = headings
    .map((h, i) => ({ prev: headings[i - 1], curr: h }))
    .filter((pair): pair is { prev: HeadingOutlineItem; curr: HeadingOutlineItem } => Boolean(pair.prev) && pair.curr.level > pair.prev.level + 1);

  if (!breaks.length) return null;

  return (
    <div class="sk-headingchain">
      {breaks.map(({ prev, curr }, i) => (
        <div class="sk-heading-break" key={`${prev.selector}-${curr.selector}-${i}`}>
          <button
            type="button"
            class="sk-heading-chip"
            title={prev.text || `H${prev.level}`}
            onClick={() => {
              locateOnPage(prev.selector, 'normal');
              onLocate?.();
            }}
          >
            H{prev.level}
          </button>
          <span class="sk-heading-sep is-broken" aria-hidden="true">
            {'>'}
          </span>
          <button
            type="button"
            class="sk-heading-chip is-broken"
            title={curr.text || `H${curr.level}`}
            onClick={() => {
              locateOnPage(curr.selector, 'warning');
              onLocate?.();
            }}
          >
            H{curr.level}
          </button>
        </div>
      ))}
    </div>
  );
}

/**
 * Images missing alt text, same signal as axe-core's image-alt rule
 * (Accessibility section already owns the pass/fail verdict on this) —
 * shown again here as a visual aid so the specific offending images are
 * visible while looking at the rest of the page's structure, same
 * reasoning as the heading outline above.
 */
function MissingAltImages({ images, onLocate }: { images: { selector: string; src: string }[]; onLocate?: () => void }) {
  if (!images.length) return null;
  const origin = window.location.origin;

  return (
    <div class="sk-rows">
      {images.map((img) => (
        <button
          type="button"
          class="sk-row is-actionable"
          key={img.selector}
          onClick={() => {
            locateOnPage(img.selector, 'warning');
            onLocate?.();
          }}
        >
          <div class="sk-row-main">
            <span class="sk-row-path">{relativizeUrl(img.src, origin)}</span>
            <span class="sk-row-detail">No alt attribute, and not marked decorative</span>
          </div>
          <TargetIcon size={13} />
        </button>
      ))}
    </div>
  );
}

/**
 * A labeled URL with a one-click copy-to-clipboard action — used by the
 * Preview vs Live tab to hand the author both URLs to paste into a real
 * comparison tool, since Sanity's own fetch() can't read the counterpart
 * page itself (see consistency.ts).
 */
function CopyUrlRow({ label, url }: { label: string; url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable or permission denied — nothing safe to fall back to.
    }
  }

  return (
    <button type="button" class={`sk-row is-actionable${copied ? ' is-copied' : ''}`} onClick={copy} title={copied ? 'Copied' : `Copy ${url}`}>
      <div class="sk-row-main">
        <span class="sk-row-detail">{label}</span>
        <span class="sk-row-path">{url}</span>
      </div>
      <CopyIcon size={13} />
    </button>
  );
}

const THRUUU_COMPARE_URL = 'https://thruuu.com/free-seo-tools/page-comparison-tool';

/**
 * No auto-diff here — Sanity's own fetch() can't read the counterpart page
 * (CORS; see consistency.ts and CLAUDE.md for why this was tried and
 * removed once already). This hands the author both URLs to copy and a
 * link to a real tool that does the comparison server-side, where CORS
 * doesn't apply. Neither DiffNow nor Thruuu supports pre-filling their
 * form via URL (tested directly — neither reads query params, and
 * submitting doesn't produce a shareable link), so this is copy-paste,
 * not one-click, and that's an honest limit, not an oversight.
 */
function PreviewVsLive({ urls }: { urls: ConsistencyUrls | null }) {
  if (!urls) {
    return (
      <p class="sk-empty-note">
        This page isn't on a recognized aem.page/aem.live (or hlx.page/hlx.live) host, so there's no counterpart environment to compare against.
      </p>
    );
  }

  return (
    <>
      <div class="sk-rows">
        <CopyUrlRow label={`This page (${urls.currentHost})`} url={urls.currentUrl} />
        <CopyUrlRow label={`Counterpart (${urls.counterpartHost})`} url={urls.counterpartUrl} />
      </div>
      <a class="sk-docs" href={THRUUU_COMPARE_URL} target="_blank" rel="noreferrer">
        <span>Compare with Thruuu's page comparison tool</span>
        <ChevronRightIcon size={13} />
      </a>
    </>
  );
}

export function SeoSection({ onLocate }: SectionProps) {
  const { result } = useScan();
  const [tab, setTab] = useState<SeoTab>('Findings');
  if (!result) return <Loading label="Checking SEO signals…" />;

  const { seoFindings, seoPageInfo, linkStats, linkFindings, consistencyUrls } = result;
  const origin = window.location.origin;

  const infoRows: { label: string; value: string }[] = [
    { label: 'URL', value: seoPageInfo.url },
    { label: 'Canonical', value: seoPageInfo.canonicalHref || 'Not set' },
    { label: 'Robots tag', value: seoPageInfo.robotsContent || 'Not set — defaults to index, follow' },
    { label: 'Keywords', value: seoPageInfo.keywordsContent || 'Not set — ignored by modern search engines' },
    { label: 'Author', value: seoPageInfo.authorContent || 'Not set' },
    { label: 'Publisher', value: seoPageInfo.publisherContent || 'Not set' },
    { label: 'Lang', value: seoPageInfo.lang || 'Not set' },
  ];

  const headingBreakCount = seoPageInfo.headings.filter((h, i) => i > 0 && h.level > seoPageInfo.headings[i - 1].level + 1).length;

  return (
    <>
      <SubTabs options={SEO_TABS} active={tab} onChange={setTab} />

      {tab === 'Findings' && (
        <Block title="Findings" meta={<SeverityCounts findings={seoFindings} />}>
          <div class="sk-findings">
            {seoFindings.map((f) => (
              <FindingRow finding={f} onLocate={onLocate} key={f.id} />
            ))}
          </div>
        </Block>
      )}

      {tab === 'Metadata' && (
        <Block title="Page info">
          <div class="sk-rows">
            {infoRows.map((row) => (
              <div class="sk-row" key={row.label}>
                <div class="sk-row-main">
                  <span class="sk-row-detail">{row.label}</span>
                  <span class="sk-row-path">{row.value}</span>
                </div>
              </div>
            ))}
          </div>
          <div class="sk-linkrow">
            <a class="sk-docs" href={`${origin}/robots.txt`} target="_blank" rel="noreferrer">
              <span>robots.txt</span>
              <ChevronRightIcon size={13} />
            </a>
            <a class="sk-docs" href={`${origin}/sitemap.xml`} target="_blank" rel="noreferrer">
              <span>sitemap.xml</span>
              <ChevronRightIcon size={13} />
            </a>
          </div>
        </Block>
      )}

      {tab === 'Structure' && (
        <>
          <Block title="Page structure">
            <div class="sk-metricgrid">
              {seoPageInfo.headingCounts.map((count, i) => (
                <MetricCell
                  key={`h${i + 1}`}
                  label={`H${i + 1}`}
                  value={String(count)}
                  target="headings"
                  severity={i === 0 && count > 1 ? 'critical' : 'normal'}
                />
              ))}
              <MetricCell label="Images" value={String(seoPageInfo.imageCount)} target="on page" severity="normal" />
              <MetricCell label="Links" value={String(linkStats.total)} target="on page" severity="normal" />
            </div>
          </Block>

          {headingBreakCount > 0 && (
            <Block title="Heading outline" meta={`${headingBreakCount} skipped level${headingBreakCount > 1 ? 's' : ''}`}>
              <HeadingOutline headings={seoPageInfo.headings} onLocate={onLocate} />
            </Block>
          )}

          {seoPageInfo.imagesMissingAlt.length > 0 && (
            <Block title="Images missing alt text" meta={`${seoPageInfo.imagesMissingAlt.length}`}>
              <MissingAltImages images={seoPageInfo.imagesMissingAlt} onLocate={onLocate} />
            </Block>
          )}

          {seoPageInfo.fontsUsed.length > 0 && (
            <Block title="Fonts" meta={`${seoPageInfo.fontsUsed.length} loaded`}>
              <div class="sk-fontlist">
                {seoPageInfo.fontsUsed.map((font) => (
                  <span class="sk-font-chip" key={font}>
                    {font}
                  </span>
                ))}
              </div>
            </Block>
          )}
        </>
      )}

      {tab === 'Links' && (
        <>
          <Block title="Link analysis" meta={`${linkStats.checked} of ${linkStats.unique} checked`}>
            <div class="sk-metricgrid">
              <MetricCell label="Total" value={String(linkStats.total)} target="on page" severity="normal" />
              <MetricCell label="Unique" value={String(linkStats.unique)} target="URLs" severity="normal" />
              <MetricCell label="Internal" value={String(linkStats.internal)} target="same origin" severity="normal" />
              <MetricCell label="External" value={String(linkStats.external)} target="other origins" severity="normal" />
              <MetricCell label="No title attr" value={String(linkStats.missingTitle)} target="of total" severity="normal" />
              <MetricCell
                label="Broken"
                value={String(linkStats.broken)}
                target="checked links"
                severity={linkStats.broken > 0 ? 'critical' : 'normal'}
              />
            </div>
          </Block>

          {linkFindings.length > 0 && (
            <Block title="Broken links" meta={`${linkFindings.length} returning an error`}>
              <div class="sk-findings">
                {linkFindings.map((f) => (
                  <FindingRow finding={f} onLocate={onLocate} key={f.id} />
                ))}
              </div>
            </Block>
          )}
        </>
      )}

      {tab === 'Preview vs Live' && (
        <Block title="Preview vs live" meta="copy & compare">
          <PreviewVsLive urls={consistencyUrls} />
        </Block>
      )}
    </>
  );
}

/* ---------------- Social ---------------- */

/** How this card actually renders on each platform — real layouts, not one generic template. */
function PlatformPreview({ card, domain }: { card: SocialCard; domain: string }) {
  const img = card.imageUrl || `https://picsum.photos/seed/${encodeURIComponent(card.imageSeed)}/1200/630`;

  switch (card.platform) {
    case 'Facebook':
      return (
        <div class="sk-mock sk-mock-facebook">
          <div class="sk-mock-media">
            <img src={img} alt="" />
          </div>
          <div class="sk-mock-body">
            <span class="sk-mock-domain">{domain}</span>
            <span class="sk-mock-title">{card.title}</span>
            {card.description && <span class="sk-mock-desc">{card.description}</span>}
          </div>
        </div>
      );
    case 'X':
      return (
        <div class="sk-mock sk-mock-x">
          <div class="sk-mock-media">
            <img src={img} alt="" />
          </div>
          <div class="sk-mock-body">
            <span class="sk-mock-title">{card.title}</span>
            <span class="sk-mock-domain">{domain}</span>
          </div>
        </div>
      );
    case 'LinkedIn':
      return (
        <div class="sk-mock sk-mock-linkedin">
          <div class="sk-mock-media">
            <img src={img} alt="" />
          </div>
          <div class="sk-mock-body">
            <span class="sk-mock-title">{card.title}</span>
            <span class="sk-mock-domain">{domain}</span>
          </div>
        </div>
      );
    case 'WhatsApp':
      return (
        <div class="sk-mock sk-mock-whatsapp">
          <div class="sk-mock-bubble">
            <div class="sk-mock-media">
              <img src={img} alt="" />
            </div>
            <div class="sk-mock-body">
              <span class="sk-mock-title">{card.title}</span>
              <span class="sk-mock-domain">{domain}</span>
            </div>
          </div>
        </div>
      );
    case 'Discord':
      return (
        <div class="sk-mock sk-mock-discord">
          <div class="sk-mock-accent" />
          <div class="sk-mock-embed">
            <span class="sk-mock-domain">{domain}</span>
            <span class="sk-mock-title">{card.title}</span>
            {card.description && <span class="sk-mock-desc">{card.description}</span>}
            <div class="sk-mock-media">
              <img src={img} alt="" />
            </div>
          </div>
        </div>
      );
    default:
      return null;
  }
}

export function SocialSection(_props: SectionProps) {
  const { result } = useScan();
  const [platform, setPlatform] = useState('Facebook');
  if (!result) return <Loading label="Reading social tags…" />;

  const { socialFindings, socialCards } = result;
  const activeCard = socialCards.find((c) => c.platform === platform) ?? socialCards[0];
  const domain = window.location.hostname;

  return (
    <>
      <Block title="Preview">
        <SubTabs options={socialCards.map((c) => c.platform)} active={platform} onChange={setPlatform} />
        {activeCard && <PlatformPreview card={activeCard} domain={domain} />}
      </Block>

      <Block title="Meta-tag inspector" meta={<SeverityCounts findings={socialFindings} />}>
        <div class="sk-findings">
          {socialFindings.map((f) => (
            <FindingRow finding={f} key={f.id} />
          ))}
        </div>
      </Block>
    </>
  );
}

/* ---------------- Security ---------------- */

export function SecuritySection({ onLocate }: SectionProps) {
  const { result } = useScan();
  if (!result) return <Loading label="Checking security…" />;

  const { securityFindings } = result;
  const checkedFindings = securityFindings.filter((f) => f.severity !== 'idle');
  if (!checkedFindings.length) return <AllClear label="No security issues found" />;

  return (
    <Block title="Findings" meta={`${checkedFindings.length} total`}>
      <div class="sk-findings">
        {securityFindings.map((f) => (
          <FindingRow finding={f} onLocate={onLocate} key={f.id} />
        ))}
      </div>
    </Block>
  );
}

/* ---------------- Technical ---------------- */

const TECHNICAL_TABS = ['Limits', 'Block Structure'] as const;
type TechnicalTab = (typeof TECHNICAL_TABS)[number];

export function TechnicalSection({ onLocate }: SectionProps) {
  const { result } = useScan();
  const [tab, setTab] = useState<TechnicalTab>('Limits');
  if (!result) return <Loading label="Checking aem.live limits…" />;

  return (
    <>
      <SubTabs options={TECHNICAL_TABS} active={tab} onChange={setTab} />

      {tab === 'Limits' && (
        <>
          <Block title="Delivery & content limits" meta="aem.live limits">
            <div class="sk-findings">
              {result.limitFindings.map((f) => (
                <FindingRow finding={f} onLocate={onLocate} key={f.id} />
              ))}
            </div>
          </Block>

          <Block title="Site & GitHub" meta="sitemap, redirects, ref">
            <div class="sk-findings">
              {result.siteLimitFindings.map((f) => (
                <FindingRow finding={f} onLocate={onLocate} key={f.id} />
              ))}
            </div>
          </Block>

          <Block title="JSON sheets" meta="query-index, metadata, placeholders">
            <div class="sk-metricgrid">
              {result.jsonSheetMetrics.map((m) => (
                <MetricCell key={m.id} label={m.label} value={m.value} target={m.target} severity={m.severity} />
              ))}
            </div>
          </Block>

          <a class="sk-docs" href="https://www.aem.live/docs/limits" target="_blank" rel="noreferrer">
            <span>Full limits reference</span>
            <ChevronRightIcon size={13} />
          </a>
        </>
      )}

      {tab === 'Block Structure' && (
        <>
          <Block title="Block structure" meta="EDS block status">
            {result.blockFindings.length > 0 ? (
              <div class="sk-findings">
                {result.blockFindings.map((f) => (
                  <FindingRow finding={f} onLocate={onLocate} key={f.id} />
                ))}
              </div>
            ) : (
              <AllClear label="Every block on the page loaded cleanly" />
            )}
          </Block>

          {result.maxCellsFindings.length > 0 && (
            <Block title="Block field limits" meta="xwalk/max-cells">
              <div class="sk-findings">
                {result.maxCellsFindings.map((f) => (
                  <FindingRow finding={f} onLocate={onLocate} key={f.id} />
                ))}
              </div>
            </Block>
          )}
        </>
      )}
    </>
  );
}

/* ---------------- Accessibility ---------------- */

export function AccessibilitySection({ onLocate }: SectionProps) {
  const { result } = useScan();
  if (!result) return <Loading label="Running accessibility checks…" />;

  const { accessibilityFindings } = result;
  if (!accessibilityFindings.length) return <AllClear label="No accessibility violations found" />;

  return (
    <Block title="Findings" meta={`${accessibilityFindings.length} total`}>
      <div class="sk-findings">
        {accessibilityFindings.map((f) => (
          <FindingRow finding={f} onLocate={onLocate} key={f.id} />
        ))}
      </div>
    </Block>
  );
}
