// Mirrors eslint-plugin-xwalk's `xwalk/max-cells` rule
// (github.com/adobe-rnd/eslint-plugin-xwalk), which lints a project's
// component-models.json at build time to catch a block authoring model with
// too many editable fields — a Word/Google Docs table gets unwieldy past a
// handful of columns. This reimplements the exact same counting logic
// (field collapsing + underscore-prefix grouping, see groupNames() below —
// verified line-for-line against the rule's own test fixtures) against the
// same two files a real xwalk/Universal-Editor EDS site publishes at its
// root: component-models.json and component-definition.json. Sites that
// don't use xwalk (plain Word/Google-Docs authoring, still the common case)
// simply don't have these files, so this check quietly produces no
// findings rather than a permanent "not applicable" disclaimer on every
// non-xwalk site.
//
// One thing this can't replicate: a project's real eslint config can
// override the default limit per block (this project's own .eslintrc sets
// `section: 30`, for instance) — that config is a dev-only build file never
// shipped to the live page, so there's no way to read it from here. Every
// block is checked against the rule's own documented default of 4 fields,
// and the finding says so explicitly rather than implying it knows the
// project's real configured threshold.
import type { Finding } from '../../data/types';

export interface ComponentField {
  name: string;
  component: string;
  multi?: boolean;
  fields?: ComponentField[];
}

export interface ComponentModel {
  id: string;
  fields: ComponentField[];
}

export interface ComponentDefinitionEntry {
  plugins?: {
    xwalk?: {
      page?: {
        template?: {
          model?: string;
          'key-value'?: boolean;
        };
      };
    };
  };
}

export interface ComponentDefinitionFile {
  groups?: { components?: ComponentDefinitionEntry[] }[];
}

export interface MaxCellsRawData {
  /** null when component-models.json doesn't exist (not an xwalk site) or fails to parse. */
  models: ComponentModel[] | null;
  /** null when component-definition.json doesn't exist — the key-value exemption just never applies. */
  definitions: ComponentDefinitionFile | null;
}

const FETCH_TIMEOUT_MS = 6000;

async function fetchJson<T>(path: string): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(path, { signal: controller.signal, cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function gatherComponentModels(): Promise<MaxCellsRawData> {
  const [modelsFile, definitions] = await Promise.all([
    fetchJson<{ models?: ComponentModel[] } | ComponentModel[]>('/component-models.json'),
    fetchJson<ComponentDefinitionFile>('/component-definition.json'),
  ]);
  // The compiled file has shipped as both a bare array and a { models: [...] }
  // envelope across xwalk boilerplate versions — accept either.
  const models = Array.isArray(modelsFile) ? modelsFile : (modelsFile?.models ?? null);
  return { models, definitions };
}

/**
 * Mirrors eslint-plugin-xwalk's getFieldNames(): skips tabs (organizational,
 * not authored content), flattens a non-repeatable container's own nested
 * fields into the parent list, and counts a repeatable ("multi") container
 * as a single field rather than unpacking its per-row contents.
 */
function getFieldNames(fields: ComponentField[]): string[] {
  const names: string[] = [];
  for (const field of fields) {
    if (field.component === 'tab') continue;
    if (field.component === 'container' && !field.multi) {
      names.push(...getFieldNames(field.fields ?? []));
      continue;
    }
    names.push(field.name);
  }
  return names;
}

const COLLAPSIBLE_SUFFIXES = ['Text', 'Title', 'Type', 'Alt', 'MimeType'];

/**
 * Mirrors eslint-plugin-xwalk's groupNames() exactly: a suffixed field
 * (imageAlt) collapses into its base field (image) when both exist, since
 * authors think of "an image plus its alt text" as one cell, not two; then
 * remaining names sharing an underscore-prefix (media_link, media_linkText)
 * collapse into a single group (media), for the same reason.
 */
export function groupNames(names: string[]): string[] {
  const collapsed: string[] = [];
  for (const name of names) {
    const suffix = COLLAPSIBLE_SUFFIXES.find((s) => name.endsWith(s));
    if (suffix && names.includes(name.slice(0, name.length - suffix.length))) continue;
    collapsed.push(name);
  }

  const groups: string[] = [];
  for (const name of collapsed) {
    const match = name.match(/^([^_]+)(_.+)?$/);
    if (!match) continue;
    const group = match[1];
    if (!groups.includes(group)) groups.push(group);
  }
  return groups;
}

function isAllKeyValue(definitions: ComponentDefinitionFile | null, modelId: string): boolean {
  const allDefs = (definitions?.groups ?? []).flatMap((g) => g.components ?? []);
  const matching = allDefs.filter((def) => def.plugins?.xwalk?.page?.template?.model === modelId);
  if (!matching.length) return false;
  return matching.every((def) => Boolean(def.plugins?.xwalk?.page?.template?.['key-value']));
}

const DEFAULT_MAX_CELLS = 4;

export function evaluateMaxCells(raw: MaxCellsRawData): Finding[] {
  if (!raw.models) return [];

  const findings: Finding[] = [];
  for (const model of raw.models) {
    // *-metadata models (page-metadata, <template>-metadata) aren't rendered
    // as blocks at all, so a cell limit doesn't apply — same skip the real rule uses.
    if (model.id.endsWith('-metadata')) continue;

    const cellCount = groupNames(getFieldNames(model.fields ?? [])).length;
    if (cellCount <= DEFAULT_MAX_CELLS) continue;
    if (isAllKeyValue(raw.definitions, model.id)) continue;

    findings.push({
      id: `max-cells-${model.id}`,
      title: `"${model.id}" block exceeds the default max-cells limit`,
      detail: `eslint-plugin-xwalk's xwalk/max-cells rule defaults to ${DEFAULT_MAX_CELLS} cells per block. A live page can't read your project's eslint config, so this is checked against that default — if your config overrides the limit for "${model.id}" specifically, this may not reflect your real configured threshold.`,
      severity: 'warning',
      path: '/component-models.json',
      copyable: true,
      measured: `${cellCount} cells`,
      allowed: `${DEFAULT_MAX_CELLS} cells`,
    });
  }
  return findings;
}
