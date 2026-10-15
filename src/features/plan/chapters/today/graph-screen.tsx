import { graphStory } from '@/application/plan-story-today-graph';
import { journeyHref } from '@/features/plan/chapters/journey-href';
import type { BodyProps } from '@/features/plan/screen-bodies';
import { GraphMap } from '@/features/plan/viz/graph-map/graph-map';
import { Stops } from '@/features/plan/viz/stops/stops.client';

// The graph in three stops: who answers, who owns each field, and what is cached on the way.
export function GraphScreen({ model, outline, page }: BodyProps) {
  const story = graphStory(model);
  if (story === null) return null;
  const { graphId } = story;
  const stops = story.stops.map((stop) => ({
    ...stop,
    body: (
      <GraphMap
        graphId={graphId}
        model={model}
        purgeHref={(flowId) => journeyHref(model, outline, flowId)}
        view={stop.key}
      />
    ),
  }));
  return <Stops title={page.title} stops={stops} />;
}
