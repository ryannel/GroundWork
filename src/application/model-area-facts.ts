import { permalinkOf, homeUrlOf } from '@/domain/code-links';
import { modelText, type ModelEntity } from '@/domain/workspace-model';

import { entryFlowHref } from './entry-flow-paths';
import type { ModelIndex } from './model-index';
import type {
  AreaBoundaryView,
  AreaCallerView,
  AreaComponentView,
  AreaEndpointView,
  AreaResourceView,
} from './workspace-area';

function signatureOf(node: ModelEntity): string {
  const data = node.data;
  const method = modelText(data.method);
  const path = modelText(data.path);
  if (method !== null && path !== null) return `${method} ${path}`;
  return (
    [data.signature, data.sig, data.rpc, data.call, data.field]
      .map(modelText)
      .find((value) => value !== null) ?? node.id
  );
}
function callerOf(index: ModelIndex, id: string): AreaCallerView {
  const system = index.place(id)?.system ?? null;
  return {
    id,
    name: index.label(id),
    system,
    systemName: system === null ? null : index.label(system),
  };
}
function endpointOf(index: ModelIndex, node: ModelEntity): AreaEndpointView {
  const provider = index.get(node.parent ?? '');
  const protocol = provider?.data.kind;
  const known =
    protocol === 'rest' || protocol === 'grpc' || protocol === 'graphql' || protocol === 'sdk';
  const version = modelText(provider?.data.version);
  return {
    id: node.id,
    signature: signatureOf(node),
    ...(known ? { protocol } : {}),
    ...(version === null ? {} : { version }),
    summary: modelText(node.data.summary) ?? 'Purpose not recorded.',
    request: modelText(node.data.request),
    response: modelText(node.data.response),
    callers: [...new Set(index.callers(node.id).map((edge) => edge.from))].map((id) =>
      callerOf(index, id),
    ),
    explorer: entryFlowHref(index.model.id, { entry: node.id }),
  };
}
function endpointsOf(index: ModelIndex, id: string): readonly AreaEndpointView[] {
  return index
    .entries()
    .filter((node) => {
      if (node.kind !== 'endpoint') return false;
      if (node.place.component === id) return true;
      const provider = index.get(node.parent ?? '');
      return provider?.data.external === id || provider?.data.system === id;
    })
    .map((node) => endpointOf(index, node));
}
function resourcesOf(index: ModelIndex, id: string): readonly AreaResourceView[] {
  const edges = index.edges(id);
  return [
    ...new Map(
      edges
        .flatMap((edge): readonly AreaResourceView[] => {
          const target = edge.kind === 'consume' ? edge.from : edge.to;
          const resource = index.get(target);
          if (resource?.kind !== 'store' && resource?.kind !== 'topic') return [];
          const words = {
            read: 'Reads',
            write: 'Writes',
            publish: 'Publishes',
            consume: 'Consumes',
          };
          if (resource.id === id) return [];
          const form = modelText(resource.data.form);
          if (
            edge.kind !== 'read' &&
            edge.kind !== 'write' &&
            edge.kind !== 'publish' &&
            edge.kind !== 'consume'
          ) {
            return [];
          }
          return [
            {
              id: resource.id,
              name: index.label(resource.id),
              kind: resource.kind,
              use: words[edge.kind],
              technology: modelText(resource.data.tech),
              ...(form === null ? {} : { category: form }),
            },
          ];
        })
        .map((resource) => [`${resource.id}/${resource.use}`, resource]),
    ).values(),
  ];
}
function paletteOf(kind: ModelEntity['kind']): AreaComponentView['kind'] {
  const palette: Readonly<Record<string, AreaComponentView['kind']>> = {
    service: 'service',
    app: 'website',
    store: 'database',
    topic: 'queue',
    library: 'library',
    external: 'external',
  };
  const value = palette[kind];
  if (value === undefined) throw new Error(`Unsupported component card: ${kind}`);
  return value;
}
function modelKindOf(node: ModelEntity): AreaComponentView['modelKind'] {
  switch (node.kind) {
    case 'service':
    case 'app':
    case 'store':
    case 'topic':
    case 'library':
    case 'external': {
      return node.kind;
    }
    default: {
      return undefined;
    }
  }
}
function repositoryOf(index: ModelIndex, id: string): AreaComponentView['repository'] {
  const repos = [...new Set(index.codeHomes(id).map((home) => home.repo))];
  const repo = repos.length === 1 ? repos[0] : undefined;
  return repo === undefined ? null : { name: repo, href: homeUrlOf({ repo }) };
}
/** Card geometry is presentation; canonical kind and roles stay independently explicit. */
export function modelAreaComponentOf(
  index: ModelIndex,
  node: ModelEntity,
  palette?: AreaComponentView['kind'],
): AreaComponentView {
  const owner = index.resourceOwner(node.id);
  const modelKind = modelKindOf(node);
  const form = modelText(node.data.form);
  const parent =
    owner !== null && index.place(owner)?.system === node.place.system ? owner : undefined;
  return {
    id: node.id,
    name: index.label(node.id),
    kind: palette ?? paletteOf(node.kind),
    ...(modelKind === undefined ? {} : { modelKind }),
    roles: index.roles(node.id),
    ...(node.data.infrastructure === true ? { infrastructure: true } : {}),
    ...(parent === undefined ? {} : { parentComponent: parent }),
    summary:
      modelText(node.data.does) ??
      modelText(node.data.summary) ??
      modelText(node.data.purpose) ??
      'Purpose not recorded.',
    technology: modelText(node.data.tech),
    ...(form === null ? {} : { category: form }),
    explorer: index.href(node.id),
    repository: repositoryOf(index, node.id),
    endpoints: endpointsOf(index, node.id),
    resources: resourcesOf(index, node.id),
    entries: index
      .entries(node.id)
      .filter((entry) => entry.kind !== 'endpoint')
      .map((entry) => ({
        id: entry.id,
        kind: entry.kind,
        name: index.label(entry.id),
        href: entryFlowHref(index.model.id, { entry: entry.id }),
      })),
    citations: index
      .cites(node.id)
      .map((cite) =>
        cite.kind === 'code'
          ? { label: `${cite.repo}/${cite.path} @ ${cite.commit}`, href: permalinkOf(cite) }
          : { label: cite.id, href: index.href(cite.id) },
      ),
    dependencies: index.edges(node.id, { direction: 'out', kinds: ['call'] }).map((edge) => {
      const system = index.place(edge.to)?.system ?? null;
      return {
        id: edge.to,
        name: index.label(edge.to),
        system,
        systemName: system === null ? null : index.label(system),
        endpointId: index.get(edge.via)?.kind === 'endpoint' ? edge.via : null,
        endpoint: index.label(edge.via),
      };
    }),
  };
}
/** Boundaries remain outside systems' component lists, with their actual model identity. */
export function modelAreaBoundaryOf(index: ModelIndex, node: ModelEntity): AreaBoundaryView {
  const card = modelAreaComponentOf(index, node, 'external');
  return {
    ...card,
    kind: 'external',
    boundaryKind: node.kind === 'system' ? 'system' : 'external',
    gaps:
      node.kind === 'system' && node.data.mapped === false
        ? ['The implementing components have not been mapped.']
        : [],
  };
}
