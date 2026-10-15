import type { Model } from '@/application/plan/derive';
import { prop } from '@/application/plan/ids';
import { graphTypes, subgraphsOf } from '@/application/plan-viz-graph-base';
import { countWord, numWord } from '@/application/plan-viz-text';

// What the graph screen says at each of its three stops: the subgraphs, who owns which field, and the caches.

export type GraphVisual = 'picture' | 'grid' | 'caches';

export interface GraphStop {
  readonly key: GraphVisual;
  readonly title: string;
  readonly headline: string;
  readonly lede: string;
}

export interface GraphStory {
  readonly graphId: string;
  readonly stops: readonly GraphStop[];
}

function subgraphStop(model: Model, graphId: string): GraphStop {
  const subgraphs = subgraphsOf(model, graphId, 'asIs');
  const teams = new Set(
    subgraphs.map((s) => prop(model.asIs.get(s.service), 'team')).filter(Boolean),
  );
  const gateway = model.asIs.graphs.find((g) => g.id === graphId)?.gateway ?? graphId;
  return {
    key: 'picture',
    title: 'The subgraphs',
    headline: `${model.label(gateway)} asks only the subgraphs that own an operation’s fields; ${countWord(subgraphs.length, 'subgraph')} run by ${countWord(teams.size, 'team')}.`,
    lede: 'Read left to right. The front end sends an operation to the gateway. The bands are caches: a hit stops the request there.',
  };
}

function ownersHeadline(model: Model, graphId: string): string {
  const types = graphTypes(model, graphId, 'asIs').filter((t) => t.root === undefined);
  const ranked = types
    .map((t) => ({ t, o: model.fieldOwners(t.id, 'asIs') }))
    .toSorted((a, b) => b.o.contributors.length - a.o.contributors.length);
  const [busiest] = ranked;
  if (busiest === undefined)
    return `${countWord(subgraphsOf(model, graphId, 'asIs').length, 'subgraph')} divide the graph’s fields between them.`;
  const { o } = busiest;
  const keys = new Set(o.keyFields);
  const owning = o.contributors.filter((sg) =>
    (o.bySubgraph[sg] ?? []).some((f) => !keys.has(f)),
  ).length;
  const byKey = o.contributors.length - owning;
  const more = byKey > 0 ? `, ${numWord(byKey)} more can only look one up by its key` : '';
  return `${model.label(busiest.t.id)} is the busiest type: ${numWord(owning)} ${owning === 1 ? 'subgraph owns' : 'subgraphs own'} fields${more}.`;
}

function cachesHeadline(model: Model): string {
  const layers = new Set(
    model.asIs.stores
      .filter((s) => s.kind === 'cache' && s.layer !== undefined)
      .map((s) => s.layer),
  );
  if (layers.size === 0)
    return 'Nothing is cached on the way: every request reaches the subgraphs.';
  const any = layers.size === 1 ? 'a cache' : `any of ${numWord(layers.size)} caches`;
  return `A request can stop at ${any} before it reaches a subgraph; each decides how long an answer lives and what purges it.`;
}

/** The three stops over today's first graph; null when the plan has none. */
export function graphStory(model: Model): GraphStory | null {
  const graph = model.asIs.graphs[0];
  if (graph === undefined) return null;
  return {
    graphId: graph.id,
    stops: [
      subgraphStop(model, graph.id),
      {
        key: 'grid',
        title: 'Who owns which field',
        headline: ownersHeadline(model, graph.id),
        lede: 'Each column is a subgraph with the team that runs it; each row is a type. A field lives in the column that answers for it. Open a key to see how the other subgraphs find a row.',
      },
      {
        key: 'caches',
        title: 'The caches',
        headline: cachesHeadline(model),
        lede: 'The edge keeps whole answers, the gateway keeps pieces per subgraph, and a subgraph keeps data it would otherwise fetch. Private responses pass through the edge without being stored there.',
      },
    ],
  };
}
