import type { Model } from '@/application/plan/derive';
import type { GraphDiff } from '@/application/plan/federation-diff';
import type { GraphMode } from '@/application/plan-viz-graph-base';

import { CacheTable } from './cache-table';
import { GraphPicture } from './graph-picture';
import { OwnershipGrid } from './ownership-grid';

export type GraphView = 'picture' | 'grid' | 'caches';

export interface GraphMapProps {
  readonly model: Model;
  readonly graphId: string;
  /** Which of the three pictures: the graph left to right, who owns which field, or the caches on its path. */
  readonly view: GraphView;
  /** Today's graph by default. */
  readonly mode?: GraphMode;
  /** `model.graphDiff(graphId)`: the grid and the caches then read as before and after. */
  readonly diff?: GraphDiff | null;
  /** A team id: what other teams own is dimmed. */
  readonly lens?: string | null;
  /** Where a flow is read; gives each purge a link to the flow that does it. */
  readonly purgeHref?: (flowId: string) => string | null;
}

/** The graph as one of its three pictures. The picture ignores a diff, which only the grid and the caches show. */
export function GraphMap({
  model,
  graphId,
  view,
  mode = 'asIs',
  diff = null,
  lens = null,
  purgeHref,
}: GraphMapProps) {
  switch (view) {
    case 'picture': {
      return <GraphPicture graphId={graphId} lens={lens} mode={mode} model={model} />;
    }
    case 'grid': {
      return <OwnershipGrid diff={diff} graphId={graphId} lens={lens} mode={mode} model={model} />;
    }
    case 'caches': {
      return (
        <CacheTable
          diff={diff}
          lens={lens}
          mode={mode}
          model={model}
          {...(purgeHref === undefined ? {} : { purgeHref })}
        />
      );
    }
  }
}
