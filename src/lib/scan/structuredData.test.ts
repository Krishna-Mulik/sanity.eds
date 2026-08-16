import { describe, it, expect } from 'vitest';
import { evaluateStructuredData, type JsonLdBlock } from './structuredData';

function block(raw: unknown, selector = 'script'): JsonLdBlock {
  return { raw: typeof raw === 'string' ? raw : JSON.stringify(raw), selector };
}

describe('evaluateStructuredData', () => {
  it('warns (does not error) when there is no structured data at all', () => {
    const findings = evaluateStructuredData([]);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('warning');
  });

  it('flags invalid JSON as critical', () => {
    const findings = evaluateStructuredData([block('{ not valid json')]);
    expect(findings.find((f) => f.id.startsWith('schema-invalid'))?.severity).toBe('critical');
  });

  it('accepts a complete Organization block with no findings', () => {
    const findings = evaluateStructuredData([
      block({ '@context': 'https://schema.org', '@type': 'Organization', name: 'Cairn Supply Co.', url: 'https://cairn.example.com' }),
    ]);
    expect(findings).toHaveLength(0);
  });

  it('flags a Product block missing name', () => {
    const findings = evaluateStructuredData([block({ '@type': 'Product', sku: '123' })]);
    const finding = findings.find((f) => f.id.startsWith('schema-missing-Product'));
    expect(finding?.severity).toBe('warning');
    expect(finding?.title).toMatch(/name/);
  });

  it('flags a block with no @type at all', () => {
    const findings = evaluateStructuredData([block({ name: 'no type here' })]);
    expect(findings.find((f) => f.id.startsWith('schema-no-type'))?.severity).toBe('warning');
  });

  it('walks @graph arrays to find typed nodes', () => {
    const findings = evaluateStructuredData([
      block({ '@context': 'https://schema.org', '@graph': [{ '@type': 'Article', headline: 'Real headline' }] }),
    ]);
    expect(findings).toHaveLength(0);
  });

  it('ignores unrecognized @types rather than flagging them', () => {
    const findings = evaluateStructuredData([block({ '@type': 'SomeUncommonType', foo: 'bar' })]);
    expect(findings).toHaveLength(0);
  });
});
