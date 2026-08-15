import { useState } from 'preact/hooks';
import { Block, FindingRow, MetricCell, AllClear, Loading, SeverityCounts, SubTabs } from '../blocks';
import { buildSectionDefs } from '../../data/sections';
import { useScan } from '../../lib/scanContext';
import type { SectionId, SocialCard } from '../../data/types';
import { ChevronRightIcon } from '../icons';

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

  const { performanceScore, cwv, renderBlockers, recommendations, performanceFindings, sectionSeverity } = result;

  return (
    <>
      <div class={`sk-verdict is-${sectionSeverity.performance}`}>
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

      <Block title="Core Web Vitals" meta="this session">
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
        <a class="sk-docs" href={`https://pagespeed.web.dev/report?url=${encodeURIComponent(window.location.href)}`} target="_blank" rel="noreferrer">
          <span>Test with PageSpeed Insights</span>
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

export function SeoSection({ onLocate }: SectionProps) {
  const { result } = useScan();
  const [tab, setTab] = useState<SeoTab>('Findings');
  if (!result) return <Loading label="Checking SEO signals…" />;

  const { seoFindings, seoPageInfo, linkStats, consistencyFindings } = result;
  const origin = window.location.origin;

  const infoRows: { label: string; value: string }[] = [
    { label: 'URL', value: seoPageInfo.url },
    { label: 'Robots tag', value: seoPageInfo.robotsContent || 'Not set — defaults to index, follow' },
    { label: 'Keywords', value: seoPageInfo.keywordsContent || 'Not set — ignored by modern search engines' },
    { label: 'Author', value: seoPageInfo.authorContent || 'Not set' },
    { label: 'Publisher', value: seoPageInfo.publisherContent || 'Not set' },
    { label: 'Lang', value: seoPageInfo.lang || 'Not set' },
  ];

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
        <Block title="Page structure">
          <div class="sk-metricgrid">
            {seoPageInfo.headingCounts.map((count, i) => (
              <MetricCell key={`h${i + 1}`} label={`H${i + 1}`} value={String(count)} target="headings" severity="normal" />
            ))}
            <MetricCell label="Images" value={String(seoPageInfo.imageCount)} target="on page" severity="normal" />
            <MetricCell label="Links" value={String(linkStats.total)} target="on page" severity="normal" />
          </div>
        </Block>
      )}

      {tab === 'Links' && (
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
      )}

      {tab === 'Preview vs Live' && (
        <Block title="Preview vs live" meta={<SeverityCounts findings={consistencyFindings} />}>
          <div class="sk-findings">
            {consistencyFindings.map((f) => (
              <FindingRow finding={f} onLocate={onLocate} key={f.id} />
            ))}
          </div>
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

          <a class="sk-docs" href="https://www.aem.live/docs/limits" target="_blank" rel="noreferrer">
            <span>Full limits reference</span>
            <ChevronRightIcon size={13} />
          </a>
        </>
      )}

      {tab === 'Block Structure' && (
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
