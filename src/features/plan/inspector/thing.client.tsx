'use client';

import { usePathname } from 'next/navigation';
import { use, useMemo, useState, useTransition } from 'react';

import type { Model } from '@/application/plan/derive';
import { outlineOf, planHref, type PlanAddress } from '@/application/plan-pages';
import { entityView } from '@/application/plan-pages-entity';
import { placesOf } from '@/application/plan-pages-entity-where';
import { thingHref, topThingIds } from '@/application/plan-pages-things';
import { assetUrl } from '@/application/plan-viz-screens';
import { pendingModel } from '@/features/plan/plan-model';

import { EntityDetails } from './entity-details';
import { EntityHead } from './entity-head';
import { EntityPlaces } from './entity-places';
import { InspectorBar } from './inspector-bar.client';
import { ThingExtras } from './thing-extras';
import styles from './thing.module.css';
import { revisionSrc, VersionJump } from './version-jump.client';
import { ViewSwitch } from './view-switch.client';

interface ThingProps {
  readonly id: string;
  readonly src: string;
  readonly plan: PlanAddress;
}

interface ThingViewProps {
  readonly id: string;
  readonly model: Model;
  readonly plan: PlanAddress;
  /** The version it is shown at, null for the one being read. */
  readonly version: string | null;
}

// The thing as it is today or with the plan, then where the story tells it.
function ThingView({ id, model, plan, version }: ThingViewProps) {
  const [today, setToday] = useState(false);
  const routed: unknown = usePathname();
  const here = typeof routed === 'string' ? routed : '';
  const view = useMemo(() => entityView(model, id), [model, id]);
  const places = useMemo(() => placesOf(model, outlineOf(model, plan), id), [model, plan, id]);
  if (view === null) {
    const where = version === null ? 'The plan has' : `Version ${version} had`;
    return <p className={styles.note}>{`${where} nothing called ${id}.`}</p>;
  }
  const showToday = today && !view.planLevel;
  return (
    <>
      {view.planLevel ? null : <ViewSwitch onChange={setToday} today={showToday} />}
      <div className={styles.body}>
        <EntityHead today={showToday} view={view} />
        <EntityDetails
          image={view.image === null ? null : assetUrl(planHref(plan), view.image)}
          model={model}
          today={showToday}
          view={view}
        />
        <ThingExtras id={id} model={model} today={showToday} />
        <EntityPlaces
          here={here}
          mentionedIn={view.mentionedIn}
          mentionedParts={view.mentionedParts}
          places={places}
          sources={view.sources}
        />
      </div>
    </>
  );
}

// What the inspector shows for one id: the bar, the version it is read at, then the thing. A new id remounts it,
// so the switch starts on the plan, at the version being read, each time.
export function Thing({ id, src, plan }: ThingProps) {
  const head = use(pendingModel(src).model);
  const [version, setVersion] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const shown = version === null ? head : use(pendingModel(revisionSrc(src, version)).model);
  const page = useMemo(
    () => (head !== null && topThingIds(head).includes(id) ? thingHref(plan, id) : null),
    [head, plan, id],
  );
  if (head === null) return <p className={styles.note}>The plan could not be loaded.</p>;
  const jump = (next: string | null): void => {
    startTransition(() => {
      setVersion(next);
    });
  };
  return (
    <>
      <InspectorBar id={id} model={head} page={page} />
      <VersionJump model={head} onChange={jump} value={version} />
      {shown === null ? (
        <p className={styles.note}>{`No copy of version ${version ?? ''} was kept.`}</p>
      ) : (
        <ThingView id={id} key={version ?? ''} model={shown} plan={plan} version={version} />
      )}
    </>
  );
}
