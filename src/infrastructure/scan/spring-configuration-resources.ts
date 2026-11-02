import 'server-only';

import path from 'node:path';

import { isMap, isScalar, parseAllDocuments } from 'yaml';

import type { Gap, Source } from '@/domain/scan/scan.generated';

import { sourceDigest } from './source-index';
import type { ConfigurationBinding } from './spring-configuration-types';

export interface ConfigurationSource {
  readonly repo: string;
  readonly commit: string;
  readonly blob: string;
  readonly path: string;
  readonly content: string;
}

function sourceAt(input: ConfigurationSource, start: number, end: number): Source {
  const identity = sourceDigest(
    [input.repo, input.commit, input.path, input.blob, String(start), String(end)].join(':'),
  ).slice(0, 24);
  const host = sourceDigest(`${input.repo}:unknown`).slice(0, 16);
  return {
    kind: 'source',
    id: `source:${identity}`,
    repo: input.repo,
    commit: input.commit,
    blob: input.blob,
    path: input.path,
    host: `host:${host}`,
    authority: 'declared',
    lines: [
      input.content.slice(0, start).split('\n').length,
      input.content.slice(0, Math.max(start, end - 1)).split('\n').length,
    ],
  };
}

function leaves(
  node: unknown,
  prefix = '',
): {
  readonly key: string;
  readonly value: string | number | boolean | null;
  readonly start: number;
  readonly end: number;
}[] {
  if (!isMap(node)) throw new Error('Only scalar YAML mapping properties are supported.');
  return node.items.flatMap((pair) => {
    if (!isScalar(pair.key) || typeof pair.key.value !== 'string') {
      throw new Error('Unsupported YAML property key.');
    }
    const key = prefix === '' ? pair.key.value : `${prefix}.${pair.key.value}`;
    if (isMap(pair.value)) return leaves(pair.value, key);
    if (!isScalar(pair.value) || !pair.value.range) {
      return [];
    }
    return [
      {
        key,
        value: scalarValue(pair.value.value),
        start: pair.key.range?.[0] ?? pair.value.range[0],
        end: pair.value.range[1],
      },
    ];
  });
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function scalarValue(value: unknown): string | number | boolean | null {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    finiteNumber(value)
  ) {
    return value;
  }
  throw new Error('Unsupported scalar configuration value.');
}

function filenameProfile(file: string): string | null {
  return /^application-(.+)\.ya?ml$/u.exec(path.basename(file))?.[1] ?? null;
}

/** Parse source YAML without resolving placeholders, loading aliases or selecting an active profile. */
export function configurationResourceBindings(input: ConfigurationSource): {
  readonly bindings: readonly ConfigurationBinding[];
  readonly sources: readonly Source[];
  readonly gaps: readonly Gap[];
} {
  const root = sourceAt(input, 0, input.content.length);
  const sources = new Map([[root.id, root]]);
  try {
    const documents = parseAllDocuments(input.content, {
      keepSourceTokens: true,
      uniqueKeys: true,
    });
    const bindings = documents.map((document, position): ConfigurationBinding => {
      if (document.errors.length > 0) {
        throw new Error(document.errors.map((error) => error.message).join('; '));
      }
      return resourceBinding(input, {
        root,
        anchor: (start, end) => {
          const source = sourceAt(input, start, end);
          sources.set(source.id, source);
          return source.id;
        },
        contents: document.contents,
        position,
      });
    });
    return { bindings, sources: [...sources.values()], gaps: [] };
  } catch (error) {
    return {
      bindings: [],
      sources: [root],
      gaps: [
        {
          kind: 'gap',
          id: `gap:configuration:${root.id}`,
          source: root.id,
          reason: 'unsupported',
          description: error instanceof Error ? error.message : 'Unsupported configuration source.',
        },
      ],
    };
  }
}

function resourceBinding(
  input: ConfigurationSource,
  context: {
    readonly root: Source;
    readonly anchor: (start: number, end: number) => string;
    readonly contents: unknown;
    readonly position: number;
  },
): ConfigurationBinding {
  const { root, anchor, contents, position } = context;
  const properties: ConfigurationBinding['properties'] = leaves(contents).map((property) => {
    const source = anchor(property.start, property.end);
    return {
      key: property.key,
      value: property.value,
      value_kind:
        typeof property.value === 'string' && /\$\{|#\{/u.test(property.value)
          ? 'expression'
          : 'literal',
      type: null,
      source,
      placeholders: [...String(property.value).matchAll(/\$\{([^}]+)\}/gu)].map(
        (match) => match[1] ?? '',
      ),
    };
  });
  return {
    kind: 'configuration_binding',
    id: `configuration:${root.id}:${String(position)}`,
    source: root.id,
    format: 'yaml',
    declared_type: null,
    prefix: null,
    profile:
      properties
        .find((property) => property.key === 'spring.config.activate.on-profile')
        ?.value?.toString() ?? filenameProfile(input.path),
    properties,
    conditions: [],
    selectors: [],
    factories: [],
    completeness: 'partial',
    gaps: [
      'Only scalar mapping leaves are retained; aliases and sequences remain unsupported. Values are source declarations. Profile activation, Spring precedence, external imports, environment substitution and effective runtime configuration remain unobserved.',
    ],
  };
}
