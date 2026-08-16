import type { CheckedSectionId, ScanResult, SiteIdentity } from '../../data/types';
import { worstSeverity, type Severity } from '../severity';
import { gatherLimits, evaluateLimits } from './limits';
import {
  gatherGithubRef,
  gatherSitemap,
  gatherRedirects,
  gatherJsonSheet,
  gatherRobots,
  gatherNotFoundCheck,
  evaluateSiteLimits,
  evaluateJsonSheetMetrics,
} from './siteLimits';
import { gatherBlockStructure, gatherEdsRuntimeDetected, evaluateBlockStructure } from './blockStructure';
import { gatherSecurity, evaluateSecurity } from './security';
import { gatherSeo, evaluateSeo, buildSeoPageInfo, checkCanonicalStatus, evaluateCanonicalStatus } from './seo';
import { gatherFaviconLink, checkFavicon, evaluateFavicon } from './favicon';
import { gatherStructuredData, evaluateStructuredData } from './structuredData';
import { gatherSocial, evaluateSocial } from './social';
import { gatherLinks, checkLinks, evaluateLinks } from './links';
import {
  gatherCwv,
  evaluateCwv,
  computeScore,
  gatherResources,
  gatherRenderBlocking,
  evaluateRenderBlocking,
  evaluateLargeBundles,
  evaluateDuplicateRequests,
  gatherPreloadHints,
  evaluatePreloadHints,
  evaluateLcpPayloadBudget,
  evaluateEarlyThirdPartyConnections,
  evaluateMeasurementScope,
  gatherFormFactor,
  buildRecommendations,
} from './performance';
import { getRuntimeErrors, evaluateRuntimeErrors } from './runtimeErrors';
import { gatherAccessibility, evaluateAccessibility, evaluateHeadingStructure, gatherImageAltInfo, evaluateEmptyAltImages } from './accessibility';

function tally(list: Severity[]) {
  return {
    critical: list.filter((s) => s === 'critical').length,
    warning: list.filter((s) => s === 'warning').length,
  };
}

export async function runScan(): Promise<ScanResult> {
  // Fast, synchronous gathers first — nothing here needs the network.
  const seoRaw = gatherSeo();
  const schemaBlocks = gatherStructuredData();
  const linkInfos = gatherLinks();
  const resources = gatherResources();
  const renderBlockingCandidates = gatherRenderBlocking();
  const preloadHints = gatherPreloadHints();
  const blocks = gatherBlockStructure();
  const formFactor = gatherFormFactor();
  const refInfo = gatherGithubRef();
  const faviconRaw = gatherFaviconLink();
  const edsRuntimeDetected = gatherEdsRuntimeDetected();
  const imageAltInfo = gatherImageAltInfo();

  // Everything network- or timing-bound runs in parallel, each individually
  // bounded, so one slow check can't stall the whole scan.
  const [
    limitsRaw,
    securityRaw,
    socialRaw,
    cwvRaw,
    a11yViolations,
    linkChecks,
    sitemapInfo,
    redirectsInfo,
    queryIndexInfo,
    metadataInfo,
    placeholdersInfo,
    faviconLoaded,
    robotsInfo,
    notFoundInfo,
    canonicalCheck,
  ] = await Promise.all([
    gatherLimits(document, window, linkInfos),
    gatherSecurity(),
    gatherSocial(),
    gatherCwv(),
    gatherAccessibility().catch(() => []),
    checkLinks(linkInfos),
    gatherSitemap(),
    gatherRedirects(),
    gatherJsonSheet('/query-index.json'),
    gatherJsonSheet('/metadata.json'),
    gatherJsonSheet('/placeholders.json'),
    checkFavicon(faviconRaw),
    gatherRobots(),
    gatherNotFoundCheck(),
    checkCanonicalStatus(seoRaw),
  ]);

  const pageOrigin = window.location.origin;
  const { stats: linkStats, findings: linkFindings } = evaluateLinks(linkInfos, linkChecks);
  const renderBlockers = evaluateRenderBlocking(renderBlockingCandidates, resources, pageOrigin);
  const largeBundleFindings = evaluateLargeBundles(resources, pageOrigin);
  const duplicateFindings = evaluateDuplicateRequests(resources, pageOrigin);
  const cwv = evaluateCwv(cwvRaw);
  const performanceScore = computeScore(cwv);
  const runtimeErrorFindings = evaluateRuntimeErrors(getRuntimeErrors());
  const recommendations = buildRecommendations({ cwv, renderBlockers, largeBundles: largeBundleFindings, duplicates: duplicateFindings });
  const lcpPayloadFindings = evaluateLcpPayloadBudget(cwvRaw.lcp, resources);
  const earlyThirdPartyFindings = evaluateEarlyThirdPartyConnections(cwvRaw.lcp, resources, pageOrigin);
  const preloadFindings = evaluatePreloadHints(preloadHints, pageOrigin);
  const measurementScopeFindings = evaluateMeasurementScope(refInfo, formFactor);
  const performanceFindings = [
    ...largeBundleFindings,
    ...duplicateFindings,
    ...runtimeErrorFindings,
    ...lcpPayloadFindings,
    ...earlyThirdPartyFindings,
    ...preloadFindings,
    ...measurementScopeFindings,
  ];

  const seoFindings = [
    ...evaluateSeo(seoRaw),
    ...evaluateStructuredData(schemaBlocks),
    ...linkFindings,
    ...evaluateFavicon(faviconRaw, faviconLoaded, pageOrigin),
    ...evaluateCanonicalStatus(seoRaw.canonicalHref, canonicalCheck),
  ];
  const seoPageInfo = buildSeoPageInfo(seoRaw);
  const { findings: socialFindings, cards: socialCards } = evaluateSocial(socialRaw);
  const securityFindings = evaluateSecurity(securityRaw);
  const limitFindings = evaluateLimits(limitsRaw);
  const jsonSheets = { queryIndex: queryIndexInfo, metadata: metadataInfo, placeholders: placeholdersInfo };
  const siteLimitFindings = evaluateSiteLimits(refInfo, sitemapInfo, redirectsInfo, jsonSheets, robotsInfo, notFoundInfo);
  const jsonSheetMetrics = evaluateJsonSheetMetrics(jsonSheets);
  const blockFindings = evaluateBlockStructure(blocks, edsRuntimeDetected);
  const accessibilityFindings = [
    ...evaluateAccessibility(a11yViolations),
    ...evaluateHeadingStructure(seoRaw.headings),
    ...evaluateEmptyAltImages(imageAltInfo),
  ];
  const siteInfo: SiteIdentity | null = refInfo.matched
    ? { owner: refInfo.owner!, repo: refInfo.repo!, ref: refInfo.ref!, host: refInfo.host! }
    : null;

  const sectionSeverity: Record<CheckedSectionId, Severity> = {
    performance: worstSeverity([...cwv.map((m) => m.severity), ...renderBlockers.map((b) => b.severity), ...performanceFindings.map((f) => f.severity)]),
    seo: worstSeverity(seoFindings.map((f) => f.severity)),
    social: worstSeverity(socialFindings.map((f) => f.severity)),
    security: worstSeverity(securityFindings.map((f) => f.severity)),
    technical: worstSeverity([...limitFindings, ...siteLimitFindings, ...blockFindings, ...jsonSheetMetrics].map((f) => f.severity)),
    accessibility: worstSeverity(accessibilityFindings.map((f) => f.severity)),
  };

  const sectionBreakdown: Record<CheckedSectionId, { critical: number; warning: number }> = {
    performance: tally([...cwv.map((m) => m.severity), ...renderBlockers.map((b) => b.severity), ...performanceFindings.map((f) => f.severity)]),
    seo: tally(seoFindings.map((f) => f.severity)),
    social: tally(socialFindings.map((f) => f.severity)),
    security: tally(securityFindings.map((f) => f.severity)),
    technical: tally([...limitFindings, ...siteLimitFindings, ...blockFindings, ...jsonSheetMetrics].map((f) => f.severity)),
    accessibility: tally(accessibilityFindings.map((f) => f.severity)),
  };

  const sectionIssueCount: Record<CheckedSectionId, number> = {
    performance: cwv.filter((m) => m.severity === 'critical' || m.severity === 'warning').length + renderBlockers.filter((b) => b.severity !== 'normal').length + performanceFindings.length,
    seo: seoFindings.filter((f) => f.severity === 'critical' || f.severity === 'warning').length,
    social: socialFindings.filter((f) => f.severity !== 'normal').length,
    security: securityFindings.length,
    technical:
      [...limitFindings, ...siteLimitFindings, ...blockFindings].filter((f) => f.severity !== 'idle').length +
      jsonSheetMetrics.filter((m) => m.severity === 'critical' || m.severity === 'warning').length,
    accessibility: accessibilityFindings.length,
  };

  const criticalCount = Object.values(sectionBreakdown).reduce((sum, b) => sum + b.critical, 0);
  const warningCount = Object.values(sectionBreakdown).reduce((sum, b) => sum + b.warning, 0);
  const overallSeverity = worstSeverity(Object.values(sectionSeverity));

  return {
    performanceScore,
    formFactor,
    cwv,
    renderBlockers,
    recommendations,
    performanceFindings,
    seoFindings,
    seoPageInfo,
    linkStats,
    linkFindings,
    socialFindings,
    socialCards,
    securityFindings,
    limitFindings,
    siteLimitFindings,
    jsonSheetMetrics,
    blockFindings,
    accessibilityFindings,
    sectionSeverity,
    sectionBreakdown,
    sectionIssueCount,
    criticalCount,
    warningCount,
    overallSeverity,
    siteInfo,
  };
}
