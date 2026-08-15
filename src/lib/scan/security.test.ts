import { describe, it, expect } from 'vitest';
import { evaluateSecurity, type SecurityRawData } from './security';

function base(overrides: Partial<SecurityRawData> = {}): SecurityRawData {
  return {
    protocol: 'https:',
    headers: {},
    headersAvailable: true,
    mixedContent: [],
    cookieNames: [],
    sriViolations: [],
    thirdPartyScriptOrigins: [],
    analyticsVendors: [],
    ...overrides,
  };
}

describe('evaluateSecurity', () => {
  it('flags http as critical', () => {
    const findings = evaluateSecurity(base({ protocol: 'http:', headersAvailable: false }));
    expect(findings.find((f) => f.id === 'security-https')?.severity).toBe('critical');
  });

  it('flags every missing security header when headers are available', () => {
    const findings = evaluateSecurity(base());
    const ids = findings.map((f) => f.id);
    expect(ids).toContain('security-csp');
    expect(ids).toContain('security-hsts');
    expect(ids).toContain('security-xfo');
    expect(ids).toContain('security-xcto');
    expect(ids).toContain('security-referrer');
    expect(ids).toContain('security-permissions');
    expect(ids).toContain('security-compression');
  });

  it('does not flag CSP/HSTS/etc when the headers are all present', () => {
    const findings = evaluateSecurity(
      base({
        headers: {
          'content-security-policy': "default-src 'self'",
          'strict-transport-security': 'max-age=63072000',
          'x-frame-options': 'DENY',
          'x-content-type-options': 'nosniff',
          'referrer-policy': 'no-referrer',
          'permissions-policy': 'geolocation=()',
          'content-encoding': 'br',
        },
        analyticsVendors: ['Google Analytics'],
      }),
    );
    expect(findings.filter((f) => f.id.startsWith('security-') && f.severity !== 'idle')).toHaveLength(0);
  });

  describe('evaluateSecurity — analytics detection', () => {
    it('warns when no known analytics/martech vendor is detected', () => {
      const findings = evaluateSecurity(base({ analyticsVendors: [] }));
      expect(findings.find((f) => f.id === 'security-analytics-missing')?.severity).toBe('warning');
    });

    it('notes (not warns) detected vendors, listed by name', () => {
      const findings = evaluateSecurity(base({ analyticsVendors: ['Google Analytics', 'Google Tag Manager'] }));
      const finding = findings.find((f) => f.id === 'security-analytics-detected');
      expect(finding?.severity).toBe('idle');
      expect(finding?.title).toContain('Google Analytics');
      expect(finding?.title).toContain('Google Tag Manager');
      expect(findings.find((f) => f.id === 'security-analytics-missing')).toBeUndefined();
    });
  });

  it('does not double-flag missing X-Frame-Options when CSP already sets frame-ancestors', () => {
    const findings = evaluateSecurity(
      base({ headers: { 'content-security-policy': "frame-ancestors 'self'" } }),
    );
    expect(findings.find((f) => f.id === 'security-xfo')).toBeUndefined();
  });

  it('reports header checks as unavailable rather than silently passing when the fetch failed', () => {
    const findings = evaluateSecurity(base({ headersAvailable: false }));
    expect(findings.find((f) => f.id === 'security-headers-unavailable')?.severity).toBe('idle');
    expect(findings.find((f) => f.id === 'security-csp')).toBeUndefined();
  });

  it('flags mixed content only when reported (i.e. only on an https page)', () => {
    const findings = evaluateSecurity(base({ mixedContent: [{ url: 'http://cdn.example.com/badge.png' }] }));
    expect(findings.find((f) => f.id.startsWith('security-mixed'))?.severity).toBe('critical');
  });

  it('flags cross-origin scripts/links missing integrity', () => {
    const findings = evaluateSecurity(
      base({ sriViolations: [{ url: 'https://cdn.example.com/a.js', tag: 'script' }] }),
    );
    expect(findings.find((f) => f.id.includes('security-sri'))?.severity).toBe('warning');
  });

  it('surfaces cookie names as an informational note, not a pass/fail verdict', () => {
    const findings = evaluateSecurity(base({ cookieNames: ['session_id'] }));
    const finding = findings.find((f) => f.id === 'security-cookies');
    expect(finding?.severity).toBe('idle');
    expect(finding?.detail).toMatch(/can't be verified/);
  });
});
