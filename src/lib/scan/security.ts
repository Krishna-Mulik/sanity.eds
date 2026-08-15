// Automated security checks: HTTPS, mixed content, response security
// headers (via a same-origin fetch of the page's own URL), SRI, third-party
// script inventory, and cookie readability. Secure/HttpOnly/SameSite cookie
// *flags* are deliberately invisible to page JS by browser design — that
// limitation is surfaced as an explicit note rather than faked.
import type { Finding } from '../../data/types';
import { buildSelector } from '../selector';

const HEADER_NAMES = [
  'content-security-policy',
  'strict-transport-security',
  'x-frame-options',
  'x-content-type-options',
  'referrer-policy',
  'permissions-policy',
  'content-encoding',
] as const;

export interface SecurityRawData {
  protocol: string;
  headers: Record<string, string | null>;
  headersAvailable: boolean;
  mixedContent: { url: string; selector?: string }[];
  cookieNames: string[];
  sriViolations: { url: string; tag: 'script' | 'link'; selector?: string }[];
  thirdPartyScriptOrigins: string[];
  analyticsVendors: string[];
}

// Small curated list of common analytics/martech script hosts, same spirit
// as the misspelling list in seo.ts — real signal, honestly scoped, not
// claiming to catch every custom or unlisted tool. Presence-only: it can't
// confirm data is actually flowing into a dashboard, only that the go-live
// checklist's "instrument analytics before launch" step has *something*
// wired up.
const ANALYTICS_VENDOR_PATTERNS: { pattern: RegExp; vendor: string }[] = [
  { pattern: /googletagmanager\.com/i, vendor: 'Google Tag Manager' },
  { pattern: /google-analytics\.com|analytics\.google\.com/i, vendor: 'Google Analytics' },
  { pattern: /assets\.adobedtm\.com/i, vendor: 'Adobe Experience Platform Launch' },
  { pattern: /omtrdc\.net|2o7\.net/i, vendor: 'Adobe Analytics' },
  { pattern: /cdn\.segment\.com/i, vendor: 'Segment' },
  { pattern: /connect\.facebook\.net/i, vendor: 'Meta Pixel' },
  { pattern: /static\.hotjar\.com/i, vendor: 'Hotjar' },
  { pattern: /js\.hs-scripts\.com|js\.hs-analytics\.net/i, vendor: 'HubSpot' },
  { pattern: /snap\.licdn\.com/i, vendor: 'LinkedIn Insight Tag' },
  { pattern: /static\.ads-twitter\.com|analytics\.twitter\.com/i, vendor: 'X (Twitter) Ads' },
  { pattern: /cdn\.amplitude\.com/i, vendor: 'Amplitude' },
  { pattern: /cdn\.mxpnl\.com/i, vendor: 'Mixpanel' },
  { pattern: /plausible\.io/i, vendor: 'Plausible' },
  { pattern: /cdn\.matomo\.cloud|matomo\.js/i, vendor: 'Matomo' },
];

function detectAnalyticsVendors(doc: Document): string[] {
  const srcs = Array.from(doc.querySelectorAll<HTMLScriptElement>('script[src]')).map((el) => el.src);
  const found = new Set<string>();
  for (const src of srcs) {
    for (const { pattern, vendor } of ANALYTICS_VENDOR_PATTERNS) {
      if (pattern.test(src)) found.add(vendor);
    }
  }
  return Array.from(found);
}

function crossOriginNoIntegrity(
  doc: Document,
  win: Window,
  selector: string,
  urlAttr: 'src' | 'href',
  tag: 'script' | 'link',
): { url: string; tag: 'script' | 'link'; selector?: string }[] {
  const out: { url: string; tag: 'script' | 'link'; selector?: string }[] = [];
  doc.querySelectorAll<HTMLElement>(selector).forEach((el) => {
    const url = (el as unknown as Record<string, string>)[urlAttr];
    if (!url) return;
    let origin: string;
    try {
      origin = new URL(url, doc.baseURI).origin;
    } catch {
      return;
    }
    if (origin !== win.location.origin && !el.hasAttribute('integrity')) {
      out.push({ url, tag, selector: buildSelector(el) });
    }
  });
  return out;
}

export async function gatherSecurity(doc: Document = document, win: Window = window): Promise<SecurityRawData> {
  const protocol = win.location.protocol;

  const mixedContent: { url: string; selector?: string }[] = [];
  if (protocol === 'https:') {
    doc
      .querySelectorAll<HTMLElement>('img[src], script[src], link[href], iframe[src], video[src], audio[src], source[src]')
      .forEach((el) => {
        const raw = el.getAttribute('src') ?? el.getAttribute('href');
        if (raw && /^http:\/\//i.test(raw)) mixedContent.push({ url: raw, selector: buildSelector(el) });
      });
  }

  const sriViolations = [
    ...crossOriginNoIntegrity(doc, win, 'script[src]', 'src', 'script'),
    ...crossOriginNoIntegrity(doc, win, 'link[rel="stylesheet"][href]', 'href', 'link'),
  ];

  const thirdPartyScriptOrigins = Array.from(
    new Set(
      Array.from(doc.querySelectorAll<HTMLScriptElement>('script[src]'))
        .map((el) => {
          try {
            return new URL(el.src, doc.baseURI).origin;
          } catch {
            return null;
          }
        })
        .filter((origin): origin is string => Boolean(origin) && origin !== win.location.origin),
    ),
  );

  const cookieNames = doc.cookie
    ? doc.cookie
        .split(';')
        .map((c) => c.split('=')[0]?.trim())
        .filter((name): name is string => Boolean(name))
    : [];

  const headers: Record<string, string | null> = {};
  let headersAvailable = false;
  try {
    const res = await fetch(win.location.href, { method: 'GET', cache: 'no-store', credentials: 'same-origin' });
    headersAvailable = true;
    for (const name of HEADER_NAMES) headers[name] = res.headers.get(name);
  } catch {
    headersAvailable = false;
  }

  const analyticsVendors = detectAnalyticsVendors(doc);

  return { protocol, headers, headersAvailable, mixedContent, cookieNames, sriViolations, thirdPartyScriptOrigins, analyticsVendors };
}

export function evaluateSecurity(raw: SecurityRawData): Finding[] {
  const findings: Finding[] = [];

  if (raw.protocol !== 'https:') {
    findings.push({
      id: 'security-https',
      title: 'Page not served over HTTPS',
      detail: 'Browsers mark this page "Not Secure" and block many modern APIs on a plain-http origin.',
      severity: 'critical',
      path: 'response',
    });
  }

  for (const { url, selector } of raw.mixedContent) {
    findings.push({
      id: `security-mixed-${url}`,
      title: 'Asset loaded over http',
      detail: 'Browsers block or downgrade this request on an https page.',
      severity: 'critical',
      path: url,
      targetSelector: selector,
    });
  }

  if (raw.headersAvailable) {
    const csp = raw.headers['content-security-policy'];
    if (!csp) {
      findings.push({
        id: 'security-csp',
        title: 'No Content-Security-Policy',
        detail: 'Nothing restricts which origins may execute script on this page.',
        severity: 'critical',
        path: 'response header',
      });
    }

    if (raw.protocol === 'https:' && !raw.headers['strict-transport-security']) {
      findings.push({
        id: 'security-hsts',
        title: 'No Strict-Transport-Security',
        detail: 'Browsers will still try plain http on the next visit without HSTS.',
        severity: 'warning',
        path: 'response header',
      });
    }

    const hasFrameAncestors = Boolean(csp && /frame-ancestors/i.test(csp));
    if (!raw.headers['x-frame-options'] && !hasFrameAncestors) {
      findings.push({
        id: 'security-xfo',
        title: 'No X-Frame-Options',
        detail: 'The page can be framed by any origin, which allows clickjacking.',
        severity: 'warning',
        path: 'response header',
      });
    }

    const xcto = raw.headers['x-content-type-options'];
    if (!xcto || xcto.toLowerCase() !== 'nosniff') {
      findings.push({
        id: 'security-xcto',
        title: 'No X-Content-Type-Options: nosniff',
        detail: 'Browsers may MIME-sniff responses into an unintended, executable content type.',
        severity: 'warning',
        path: 'response header',
      });
    }

    if (!raw.headers['referrer-policy']) {
      findings.push({
        id: 'security-referrer',
        title: 'Referrer-Policy not set',
        detail: 'Full URLs leak to third parties on outbound navigation.',
        severity: 'warning',
        path: 'response header',
      });
    }

    if (!raw.headers['permissions-policy']) {
      findings.push({
        id: 'security-permissions',
        title: 'Permissions-Policy not set',
        detail: 'Browser features (camera, geolocation, etc.) are not explicitly restricted for embedded content.',
        severity: 'warning',
        path: 'response header',
      });
    }

    if (!raw.headers['content-encoding']) {
      findings.push({
        id: 'security-compression',
        title: 'Response not compressed',
        detail: 'No Content-Encoding (gzip/brotli) on the main document response — larger transfer than necessary.',
        severity: 'warning',
        path: 'response header',
      });
    }
  } else {
    findings.push({
      id: 'security-headers-unavailable',
      title: "Couldn't read response headers",
      detail: 'A same-origin fetch of this page failed, so CSP/HSTS/framing/referrer/permissions headers could not be checked.',
      severity: 'idle',
    });
  }

  for (const { url, tag, selector } of raw.sriViolations) {
    findings.push({
      id: `security-sri-${url}`,
      title: `Cross-origin ${tag} missing Subresource Integrity`,
      detail: 'Without an integrity attribute, a compromised third-party host could serve altered code unnoticed.',
      severity: 'warning',
      path: url,
      targetSelector: selector,
    });
  }

  if (raw.thirdPartyScriptOrigins.length) {
    findings.push({
      id: 'security-third-party',
      title: `${raw.thirdPartyScriptOrigins.length} third-party script origin${raw.thirdPartyScriptOrigins.length > 1 ? 's' : ''}`,
      detail: raw.thirdPartyScriptOrigins.join(', '),
      severity: 'idle',
    });
  }

  if (raw.analyticsVendors.length) {
    findings.push({
      id: 'security-analytics-detected',
      title: `Analytics/martech detected: ${raw.analyticsVendors.join(', ')}`,
      detail: "Presence only — confirm visitor data is actually flowing into your reporting dashboards before go-live, since that can't be verified from the page alone.",
      severity: 'idle',
    });
  } else {
    findings.push({
      id: 'security-analytics-missing',
      title: 'No known analytics or martech script detected',
      detail: 'Checked against a small list of common vendors (GA4, GTM, Adobe Launch/Analytics, Segment, Meta Pixel, HubSpot, etc.) — a custom or unlisted tool would not be caught. If this site is meant to track visitors, confirm instrumentation is in place before go-live.',
      severity: 'warning',
    });
  }

  if (raw.cookieNames.length) {
    findings.push({
      id: 'security-cookies',
      title: `${raw.cookieNames.length} cookie${raw.cookieNames.length > 1 ? 's' : ''} readable from page JavaScript`,
      detail: `${raw.cookieNames.join(', ')} — Secure/HttpOnly/SameSite flags can't be verified from page JS (that's the browser working as intended), only checked from response headers server-side.`,
      severity: 'idle',
    });
  }

  return findings;
}
