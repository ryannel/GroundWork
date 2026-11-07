import type { ModelJourneyWalk } from '@/application/model-journeys';
import { journeyClaim } from '@/application/today-journeys';
import { ModelPlanText, ModelPlanValue } from '@/features/plan/model-plan-record';
import { Callout } from '@/ui/callout';
import { PageHeader } from '@/ui/page-header';
import { Stack } from '@/ui/stack';

import { ModelTodayFlow } from './model-today-flow';

/** A user journey keeps its own moves and explicitly named narratives; neither supplies inferred execution. */
export function ModelJourney({
  walk,
  labelOf,
}: {
  readonly walk: ModelJourneyWalk;
  readonly labelOf: (id: string) => string;
}) {
  const lookup = { labelOf };
  return (
    <Stack gap={4}>
      <PageHeader title={walk.journey.title} description={journeyClaim(walk.journey)} />
      {walk.source === null ? null : <ModelPlanValue value={walk.source} lookup={lookup} />}
      {walk.interactions.length === 0 ? null : (
        <section>
          <h2>The journey, move by move</h2>
          <ol>
            {walk.interactions.map((move, at) => (
              <li key={`${move.view.id}:${String(at)}`}>
                <h3>{move.view.name}</h3>
                <ModelPlanValue value={move.raw} lookup={lookup} />
              </li>
            ))}
          </ol>
        </section>
      )}
      {walk.flows.length === 0 ? (
        <Callout title="No authored flows are linked">
          The recorded journey remains visible; its implementation is not inferred from its
          description.
        </Callout>
      ) : (
        walk.flows.map((flow) => <ModelTodayFlow key={flow.id} flow={flow} />)
      )}
      {walk.gaps.length === 0 ? null : (
        <Callout title="Gaps">
          {walk.gaps.map((gap, at) => (
            <ModelPlanText key={`${gap.id}:${String(at)}`} text={gap.message} lookup={lookup} />
          ))}
        </Callout>
      )}
    </Stack>
  );
}
