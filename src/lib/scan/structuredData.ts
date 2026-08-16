// schema.org structured data: parses every application/ld+json block and
// checks common @types for the fields search engines expect for rich
// results. Not an exhaustive schema.org validator — a curated set of the
// most common types (Organization/Product/Article/BreadcrumbList/WebSite/
// WebPage/LocalBusiness/Person).
import type { Finding } from '../../data/types';
import { buildSelector } from '../selector';

export interface JsonLdBlock {
  raw: string;
  selector: string;
}

export function gatherStructuredData(doc: Document = document): JsonLdBlock[] {
  return Array.from(doc.querySelectorAll('script[type="application/ld+json"]')).map((el) => ({
    raw: el.textContent || '',
    selector: buildSelector(el),
  }));
}

const REQUIRED_FIELDS: Record<string, string[]> = {
  Organization: ['name', 'url'],
  Product: ['name'],
  Article: ['headline'],
  NewsArticle: ['headline'],
  BlogPosting: ['headline'],
  BreadcrumbList: ['itemListElement'],
  WebSite: ['name', 'url'],
  WebPage: ['name'],
  LocalBusiness: ['name', 'address'],
  Person: ['name'],
};

function collectTypedNodes(data: unknown): Record<string, unknown>[] {
  const nodes: Record<string, unknown>[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (value && typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      if ('@type' in obj) nodes.push(obj);
      if (Array.isArray(obj['@graph'])) (obj['@graph'] as unknown[]).forEach(visit);
    }
  };
  visit(data);
  return nodes;
}

function isMissing(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

export function evaluateStructuredData(blocks: JsonLdBlock[]): Finding[] {
  const findings: Finding[] = [];

  if (blocks.length === 0) {
    findings.push({
      id: 'schema-none',
      title: 'No structured data found',
      detail: 'Not required for every page, but JSON-LD helps search engines understand rich content like products or articles.',
      severity: 'warning',
    });
    return findings;
  }

  for (const block of blocks) {
    const text = block.raw.trim();
    if (!text) continue;

    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch (err) {
      findings.push({
        id: `schema-invalid-${block.selector}`,
        title: 'Invalid structured data (JSON-LD)',
        detail: `Could not parse as JSON: ${err instanceof Error ? err.message : String(err)}`,
        severity: 'critical',
        targetSelector: block.selector,
        path: 'script[type="application/ld+json"]',
      });
      continue;
    }

    const nodes = collectTypedNodes(data);
    if (nodes.length === 0) {
      findings.push({
        id: `schema-no-type-${block.selector}`,
        title: 'Structured data block has no @type',
        detail: 'Without @type, search engines cannot tell what this data describes.',
        severity: 'warning',
        targetSelector: block.selector,
      });
      continue;
    }

    for (const node of nodes) {
      const rawType = node['@type'];
      const types = Array.isArray(rawType) ? (rawType as string[]) : rawType ? [rawType as string] : [];
      for (const type of types) {
        const required = REQUIRED_FIELDS[type];
        if (!required) continue;
        const missing = required.filter((field) => isMissing(node[field]));
        if (missing.length) {
          findings.push({
            id: `schema-missing-${type}-${missing.join('-')}-${block.selector}`,
            title: `${type} structured data missing ${missing.join(', ')}`,
            detail: `Search engines expect ${missing.join(', ')} on a ${type} entry for rich results.`,
            severity: 'warning',
            targetSelector: block.selector,
            path: `@type: ${type}`,
          });
        }
      }
    }
  }

  return findings;
}
