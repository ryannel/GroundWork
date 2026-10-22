import type { Model } from '@/application/plan/derive';
import { prop } from '@/application/plan/ids';

// How a call travels, in the words people use for it: a GraphQL query sent to the graph, a REST call, a gRPC call.

const NAMES: Readonly<Record<string, string>> = {
  graphql: 'GraphQL',
  rest: 'REST',
  grpc: 'gRPC',
  https: 'HTTPS',
  soap: 'SOAP',
};

const text = (v: unknown): string => (typeof v === 'string' ? v : '');

/** "GraphQL" for an operation or a GraphQL endpoint, "REST" for a REST endpoint; null when the model does not say. */
export function protocolOf(model: Model, via: string): string | null {
  const n = model.get(via);
  if (n?.$type === 'operation') return 'GraphQL';
  if (!via.startsWith('api:')) return null;
  const proto = text(prop(model.get(text(prop(n, '$parent'))), 'protocol')).toLowerCase();
  if (proto === '') return null;
  return NAMES[proto] ?? proto.toUpperCase();
}

/** How a call reads in words: "GraphQL query", "GraphQL mutation", "REST call"; null when the model does not say. */
export function callWords(model: Model, via: string): string | null {
  const n = model.get(via);
  if (n?.$type === 'operation') {
    const kind = text(prop(n, 'kind'));
    return `GraphQL ${kind === '' ? 'query' : kind}`;
  }
  const proto = protocolOf(model, via);
  return proto === null ? null : `${proto} call`;
}
