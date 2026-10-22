import type { Model } from '@/application/plan/derive';
import { entityView, type EntityGroup, type EntityView } from '@/application/plan-pages-entity';
import { placeAmongOf } from '@/application/plan-pages-things';
import { assetUrl } from '@/application/plan-viz-screens';
import { todayReaderOf } from '@/application/today-reader';
import { codeEvidenceOf, todayPlaceOf } from '@/application/today-thing';
import type { Workspace } from '@/domain/workspace';
import type { Attribution } from '@/domain/workspace-model';
import { EntityDetails, EntityGroups } from '@/features/plan/inspector/entity-details';
import { EntityHead } from '@/features/plan/inspector/entity-head';
import { EntityPlaces } from '@/features/plan/inspector/entity-places';
import { ThingExtras } from '@/features/plan/inspector/thing-extras';
import { ThingRegister } from '@/features/plan/thing-page/thing-register';

import { ThingInside } from './thing-inside';
import { TodayEvidence } from './today-evidence';
import { Section } from './today-section';
import styles from './today-thing.module.css';
import { Place, TopLine } from './today-wayfinding';

interface TodayThingProps {
  readonly workspace: Workspace;
  readonly model: Model;
  /** Who said each fact and where in the code, by id. */
  readonly attribution: Readonly<Record<string, Attribution>>;
  readonly id: string;
}

const FLOW_GROUPS = new Set(['Flows that use it', 'Steps that use it']);

const split = (view: EntityView) => {
  const links: EntityGroup[] = [
    ...view.uses,
    ...view.usedBy.filter((g) => !FLOW_GROUPS.has(g.label)),
  ];
  const flows = view.usedBy.filter((g) => FLOW_GROUPS.has(g.label));
  return { links, flows };
};

/** One thing of today on a page of its own: what it means, where it sits, what it talks to, the flows that use
 * it and the code that says so. Null for no such thing. Put it inside WorkspaceShell. */
export function TodayThing({ workspace, model, attribution, id }: TodayThingProps) {
  const view = entityView(model, id);
  const among = placeAmongOf(model, id);
  if (view === null || among === null) return null;
  const reader = todayReaderOf(workspace.id, 1);
  const place = todayPlaceOf(workspace, model, id);
  const { links, flows } = split(view);
  return (
    <>
      <TopLine count={among.count} place={place} workspaceId={workspace.id} />
      <div className={styles.layout}>
        <ThingRegister
          base={reader.thingBase}
          id={id}
          model={model}
          siblings={among.siblings}
          title={among.every}
        />
        <article className={styles.article}>
          <EntityHead heading="h1" today view={view} />
          {place === null ? null : <Place base={reader.thingBase} place={place} />}
          <EntityDetails
            image={view.image === null ? null : assetUrl(reader.assetBase, view.image)}
            model={model}
            today
            view={{ ...view, uses: [], usedBy: [] }}
          />
          {links.length === 0 ? null : (
            <Section title="What it works with">
              <EntityGroups groups={links} />
            </Section>
          )}
          <ThingInside id={id} model={model} />
          <ThingExtras id={id} model={model} today />
          {flows.length === 0 ? null : (
            <Section title="Where it takes part">
              <EntityGroups groups={flows} />
            </Section>
          )}
          <Section title="In the code">
            <TodayEvidence
              evidence={codeEvidenceOf(attribution, id)}
              id={id}
              model={model}
              sources={view.sources}
            />
          </Section>
          <EntityPlaces
            here=""
            mentionedIn={view.mentionedIn}
            mentionedParts={[]}
            places={[]}
            sources={[]}
          />
        </article>
      </div>
    </>
  );
}
