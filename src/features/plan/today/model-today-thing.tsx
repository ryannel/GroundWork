import { modelAssetsOf } from '@/application/model-assets';
import type { ModelIndex } from '@/application/model-index';
import { modelInspectionOf, modelInspectionRef } from '@/application/model-inspection';
import { isAuthoredReference } from '@/domain/ids';
import { EntityDetailsContent } from '@/features/plan/inspector/entity-details';
import { EntityHead } from '@/features/plan/inspector/entity-head';
import { EntityPlaces } from '@/features/plan/inspector/entity-places';
import { NativeInspectionExtras } from '@/features/plan/inspector/native-inspection-extras';
import { ModelPlanAssets } from '@/features/plan/model-plan-assets';
import { ModelPlanValue } from '@/features/plan/model-plan-record';
import { ThingRegister } from '@/features/plan/thing-page/thing-register';
import { Callout } from '@/ui/callout';
import { Markdown } from '@/ui/markdown';
import { Mention } from '@/ui/mention';
import { Stack } from '@/ui/stack';

import { TodayThingFrame } from './today-thing';

/** Current detail uses the same canonical inspection as the browser, without shipping its workspace index. */
export function ModelTodayThing({
  index,
  id,
}: {
  readonly index: ModelIndex;
  readonly id: string;
}) {
  const context = { plan: null, profile: null, beforeIndex: index, afterIndex: index };
  const inspection = modelInspectionOf(context, id);
  if (inspection === null) return null;
  const siblings = index.entities
    .filter(
      (node) =>
        node.kind === index.get(id)?.kind &&
        node.kind !== 'evidence' &&
        node.parent === index.get(id)?.parent,
    )
    .map((node) => node.id);
  return (
    <TodayThingFrame
      register={
        <ThingRegister
          base={`/${index.model.id}/things/`}
          id={id}
          siblings={siblings}
          title="Also recorded here"
          model={index}
        />
      }
    >
      <Stack gap={3}>
        <EntityHead view={inspection.view} heading="h1" today />
        {inspection.gaps.length === 0 ? null : (
          <Callout title="Gaps">
            <ul>
              {inspection.gaps.map((gap, at) => (
                <li key={`${gap.id}:${String(at)}`}>{gap.message}</li>
              ))}
            </ul>
          </Callout>
        )}
        <EntityDetailsContent
          view={inspection.view}
          today
          image={null}
          renderText={(text) => (
            <Markdown
              text={text}
              isReference={isAuthoredReference}
              renderRef={(reference) => <Mention {...modelInspectionRef(context, reference)} />}
            />
          )}
        />
        <NativeInspectionExtras index={index} id={id} />
        <ModelPlanAssets assets={modelAssetsOf(context, id)} />
        <EntityPlaces
          here=""
          sources={inspection.view.sources}
          places={[]}
          mentionedIn={inspection.view.mentionedIn}
          mentionedParts={inspection.view.mentionedParts}
        />
        <details>
          <summary>Recorded detail</summary>
          <ModelPlanValue value={inspection.raw} lookup={{ labelOf: index.label }} />
        </details>
      </Stack>
    </TodayThingFrame>
  );
}
