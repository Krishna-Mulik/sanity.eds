import { describe, it, expect } from 'vitest';
import { evaluateMaxCells, groupNames, type ComponentModel, type ComponentDefinitionFile, type MaxCellsRawData } from './maxCells';

// These model fixtures are copied verbatim from eslint-plugin-xwalk's own
// test suite (tests/rules/max-cells/component-models.json,
// github.com/adobe-rnd/eslint-plugin-xwalk) — real, verified inputs with
// known-correct cell counts, not invented examples.
const FIXTURE_MODELS: ComponentModel[] = [
  {
    id: 'model-with-2-fields-collapsed-to-one-cell',
    fields: [
      { name: 'link', component: 'text' },
      { name: 'linkText', component: 'text' },
    ],
  },
  {
    id: 'model-with-4-fields',
    fields: [
      { name: 'text1', component: 'text' },
      { name: 'text2', component: 'text' },
      { name: 'text3', component: 'text' },
      { name: 'text4', component: 'text' },
    ],
  },
  {
    id: 'model-with-4-fields-key-value-only',
    fields: [
      { name: 'text1', component: 'text' },
      { name: 'text2', component: 'text' },
      { name: 'text3', component: 'text' },
      { name: 'text4', component: 'text' },
    ],
  },
  {
    id: 'model-with-6-fields-in-2-groups',
    fields: [
      { name: 'group1_text1', component: 'text' },
      { name: 'group1_text2', component: 'text' },
      { name: 'group2_text1', component: 'text' },
      { name: 'group2_text2', component: 'text' },
      { name: 'group2_text3', component: 'text' },
      { name: 'group2_text4', component: 'text' },
    ],
  },
  {
    id: 'model-with-2-tabs-2-fields-each',
    fields: [
      { name: 'tab1', component: 'tab' },
      { name: 'text1', component: 'text' },
      { name: 'text2', component: 'text' },
      { name: 'tab2', component: 'tab' },
      { name: 'text3', component: 'text' },
      { name: 'text4', component: 'text' },
    ],
  },
  {
    id: 'model-with-2-containers-2-fields-each',
    fields: [
      { name: 'container1', component: 'container', fields: [{ name: 'text1', component: 'text' }, { name: 'text2', component: 'text' }] },
      { name: 'container2', component: 'container', fields: [{ name: 'text3', component: 'text' }, { name: 'text4', component: 'text' }] },
    ],
  },
  {
    id: 'model-with-4-fields-collapsed-to-one-cell',
    fields: [
      { name: 'media_image', component: 'custom-picker' },
      { name: 'media_imageMimeType', component: 'custom-picker:mimetype' },
      { name: 'media_imageAlt', component: 'text' },
      { name: 'media_link', component: 'text' },
      { name: 'media_linkText', component: 'text' },
      { name: 'media_linkTitle', component: 'text' },
      { name: 'media_linkType', component: 'text' },
    ],
  },
  {
    id: 'page-metadata',
    fields: [
      {
        name: 'seo',
        component: 'container',
        fields: [
          { name: 'pageTitle', component: 'text' },
          { name: 'description', component: 'text' },
          { name: 'keywords', component: 'text', multi: true },
        ],
      },
      {
        name: 'social',
        component: 'container',
        fields: [
          { name: 'og:title', component: 'text', multi: true },
          { name: 'og:image', component: 'reference', multi: true },
        ],
      },
    ],
  },
  {
    id: 'model-with-2-container-multi-with-2-fields-each',
    fields: [
      { name: 'container1', component: 'container', multi: true, fields: [{ name: 'text1', component: 'text' }, { name: 'text2', component: 'text' }] },
      { name: 'container2', component: 'container', multi: true, fields: [{ name: 'text3', component: 'text' }, { name: 'text4', component: 'text' }] },
    ],
  },
];

// Copied verbatim from eslint-plugin-xwalk's tests/rules/max-cells/component-definition.json.
const FIXTURE_DEFINITIONS: ComponentDefinitionFile = {
  groups: [
    {
      components: [
        {
          plugins: { xwalk: { page: { template: { model: 'model-with-4-fields-key-value-only', 'key-value': true } } } },
        },
        {
          plugins: { xwalk: { page: { template: { model: 'model-with-2-fields-collapsed-to-one-cell' } } } },
        },
      ],
    },
  ],
};

describe('groupNames', () => {
  it('collapses a suffixed field (linkText) into its base field (link) when both exist', () => {
    expect(groupNames(['link', 'linkText'])).toEqual(['link']);
  });

  it('does not collapse a suffixed field when its base field is absent', () => {
    expect(groupNames(['linkText'])).toEqual(['linkText']);
  });

  it('groups names sharing an underscore prefix into one cell', () => {
    expect(groupNames(['group1_text1', 'group1_text2', 'group2_text1'])).toEqual(['group1', 'group2']);
  });

  it('collapses every Alt/MimeType/Text/Title/Type suffix variant of the same base into one cell', () => {
    const names = ['media_image', 'media_imageMimeType', 'media_imageAlt', 'media_link', 'media_linkText', 'media_linkTitle', 'media_linkType'];
    expect(groupNames(names)).toEqual(['media']);
  });
});

describe('evaluateMaxCells', () => {
  function raw(overrides: Partial<MaxCellsRawData> = {}): MaxCellsRawData {
    return { models: FIXTURE_MODELS, definitions: FIXTURE_DEFINITIONS, ...overrides };
  }

  it('produces no findings when component-models.json was not found (not an xwalk site)', () => {
    expect(evaluateMaxCells(raw({ models: null }))).toHaveLength(0);
  });

  it(
    "flags nothing against the real rule's own standard fixture set at the true default limit of 4 — matching the rule's own " +
      "RuleTester 'valid: default configuration' case exactly (none of these models actually exceed 4 cells; the rule's own " +
      "'invalid' assertions used a stricter {'*': 1} override, not the default, to force violations)",
    () => {
      expect(evaluateMaxCells(raw())).toHaveLength(0);
    },
  );

  it('flags a model whose grouped cell count genuinely exceeds the default limit of 4, reporting the exact measured/allowed counts', () => {
    const models: ComponentModel[] = [
      { id: 'oversized-block', fields: [1, 2, 3, 4, 5].map((n) => ({ name: `field${n}`, component: 'text' })) },
    ];
    const findings = evaluateMaxCells(raw({ models }));
    expect(findings).toHaveLength(1);
    expect(findings[0].id).toBe('max-cells-oversized-block');
    expect(findings[0].measured).toBe('5 cells');
    expect(findings[0].allowed).toBe('4 cells');
    expect(findings[0].severity).toBe('warning');
  });

  it('does not flag a page-metadata model even with many fields — it is not rendered as a block, so a cell limit does not apply', () => {
    const models: ComponentModel[] = [
      { id: 'section-metadata', fields: [1, 2, 3, 4, 5, 6].map((n) => ({ name: `field${n}`, component: 'text' })) },
    ];
    expect(evaluateMaxCells(raw({ models }))).toHaveLength(0);
  });

  it('does not flag an over-limit model whose every block usage is a key-value block', () => {
    const models: ComponentModel[] = [
      { id: 'oversized-key-value', fields: [1, 2, 3, 4, 5].map((n) => ({ name: `field${n}`, component: 'text' })) },
    ];
    const definitions: ComponentDefinitionFile = {
      groups: [{ components: [{ plugins: { xwalk: { page: { template: { model: 'oversized-key-value', 'key-value': true } } } } }] }],
    };
    expect(evaluateMaxCells({ models, definitions })).toHaveLength(0);
  });

  it('does flag an over-limit model when component-definition.json is missing — the key-value exemption just never applies', () => {
    const models: ComponentModel[] = [
      { id: 'oversized-key-value', fields: [1, 2, 3, 4, 5].map((n) => ({ name: `field${n}`, component: 'text' })) },
    ];
    expect(evaluateMaxCells({ models, definitions: null })).toHaveLength(1);
  });

  it('is copyable (points at component-models.json) rather than locatable — a JSON schema entry has no DOM element to scroll to', () => {
    const models: ComponentModel[] = [
      { id: 'oversized-block', fields: [1, 2, 3, 4, 5].map((n) => ({ name: `field${n}`, component: 'text' })) },
    ];
    const findings = evaluateMaxCells(raw({ models }));
    expect(findings.every((f) => f.copyable && f.path === '/component-models.json' && !f.targetSelector)).toBe(true);
  });
});
