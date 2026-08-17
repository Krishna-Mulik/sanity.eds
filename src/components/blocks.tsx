import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import type { Finding } from '../data/types';
import type { Severity } from '../lib/severity';
import { SEVERITY_LABEL } from '../lib/severity';
import { TargetIcon, CopyIcon, CheckIcon, PulseIcon } from './icons';
import { locateOnPage } from '../lib/locate';

/** Section heading. Sections are built only from the blocks in this file. */
export function Block({ title, meta, children }: { title: string; meta?: ComponentChildren; children: ComponentChildren }) {
  return (
    <section class="sk-block">
      <header class="sk-block-head">
        <h3 class="sk-block-title">{title}</h3>
        {meta && <span class="sk-block-meta">{meta}</span>}
      </header>
      {children}
    </section>
  );
}

/**
 * A single check result, always fully visible. No accordion: the point of
 * the panel is to read everything wrong with the page in one pass.
 */
export function FindingRow({ finding, onLocate }: { finding: Finding; onLocate?: () => void }) {
  const [copied, setCopied] = useState(false);
  const canCopy = Boolean(finding.copyable && finding.path);
  const canLocate = !canCopy && Boolean(finding.targetSelector);

  async function copyPath() {
    // finding.path is usually origin-relative (/favicon.ico), needing the
    // current page's origin prepended — but a few findings (like a link to
    // an external GitHub repo) carry an already-absolute URL, which must be
    // copied as-is rather than getting this page's origin glued onto it.
    const fullUrl = /^https?:\/\//i.test(finding.path!) ? finding.path! : `${window.location.origin}${finding.path}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable or permission denied — nothing safe to fall back to.
    }
  }

  return (
    <article class={`sk-finding is-${finding.severity}`}>
      <div class="sk-finding-head">
        <span class="sk-finding-dot" aria-hidden="true" />
        <h4 class="sk-finding-title">{finding.title}</h4>
        <span class="sk-finding-sev">{finding.severityLabel ?? SEVERITY_LABEL[finding.severity]}</span>
      </div>
      <p class="sk-finding-detail">{finding.detail}</p>

      {finding.measured && (
        <p class="sk-finding-measure">
          <span class="sk-measure-value">{finding.measured}</span>
          <span class="sk-measure-sep">of</span>
          <span class="sk-measure-allowed">{finding.allowed}</span>
          <span class="sk-measure-label">allowed</span>
        </p>
      )}

      {finding.path &&
        (canCopy ? (
          <button
            type="button"
            class={`sk-path is-actionable${copied ? ' is-copied' : ''}`}
            onClick={copyPath}
            title={copied ? 'Copied' : `Copy ${/^https?:\/\//i.test(finding.path!) ? finding.path! : `${window.location.origin}${finding.path}`}`}
          >
            <span class="sk-path-text">{finding.path}</span>
            <CopyIcon size={13} />
          </button>
        ) : canLocate ? (
          <button
            type="button"
            class="sk-path is-actionable"
            onClick={() => {
              locateOnPage(finding.targetSelector!, finding.severity);
              onLocate?.();
            }}
            title={`Find ${finding.path} on the page`}
          >
            <span class="sk-path-text">{finding.path}</span>
            <TargetIcon size={13} />
          </button>
        ) : (
          <p class="sk-path">
            <span class="sk-path-text">{finding.path}</span>
          </p>
        ))}
    </article>
  );
}

/** The critical/warning/normal counts pill row atop a checklist-style block. */
export function SeverityCounts({ findings }: { findings: Finding[] }) {
  const critical = findings.filter((f) => f.severity === 'critical').length;
  const warning = findings.filter((f) => f.severity === 'warning').length;
  const normal = findings.filter((f) => f.severity === 'normal').length;
  return (
    <div class="sk-counts">
      <span class="sk-count is-critical">{critical}</span>
      <span class="sk-count is-warning">{warning}</span>
      <span class="sk-count is-normal">{normal}</span>
    </div>
  );
}

/** Segmented control for switching between views within a section (not between sections). */
export function SubTabs<T extends string>({ options, active, onChange }: { options: readonly T[]; active: T; onChange: (value: T) => void }) {
  return (
    <div class="sk-subtabs" role="tablist">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          role="tab"
          aria-selected={option === active}
          class={`sk-subtab${option === active ? ' is-active' : ''}`}
          onClick={() => onChange(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

export function MetricCell({
  label,
  value,
  target,
  severity,
}: {
  label: string;
  value: string;
  target: string;
  severity: Severity;
}) {
  return (
    <div class={`sk-metric is-${severity}`}>
      <span class="sk-metric-label">{label}</span>
      <span class="sk-metric-value">{value}</span>
      <span class="sk-metric-target">target {target}</span>
    </div>
  );
}

export function AllClear({ label }: { label: string }) {
  return (
    <div class="sk-clear">
      <CheckIcon size={18} />
      <span>{label}</span>
    </div>
  );
}

/** Shown only if a section renders before its scan has resolved. */
export function Loading({ label }: { label: string }) {
  return (
    <div class="sk-clear is-loading">
      <PulseIcon size={18} />
      <span>{label}</span>
    </div>
  );
}
