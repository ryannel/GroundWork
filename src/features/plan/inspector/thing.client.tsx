'use client';

import { usePathname } from 'next/navigation';
import { use, useMemo, useState } from 'react';

import { outlineOf, planHref, type PlanAddress } from '@/application/plan-pages';
import { entityView } from '@/application/plan-pages-entity';
import { placesOf } from '@/application/plan-pages-entity-where';
import { assetUrl } from '@/application/plan-viz-screens';
import { pendingModel } from '@/features/plan/plan-model';

import { EntityDetails } from './entity-details';
import { EntityHead } from './entity-head';
import { EntityPlaces } from './entity-places';
import { InspectorBar } from './inspector-bar.client';
import styles from './thing.module.css';
import { ViewSwitch } from './view-switch.client';

interface ThingProps {
  readonly id: string;
  readonly src: string;
  readonly plan: PlanAddress;
}

// What the inspector shows for one id: the bar, then the thing as it is today or with the plan, then where the
// story tells it. A new id remounts it, so the switch starts on the plan each time.
export function Thing({ id, src, plan }: ThingProps) {
  const model = use(pendingModel(src).model);
  const [today, setToday] = useState(false);
  const routed: unknown = usePathname();
  const here = typeof routed === 'string' ? routed : '';
  const view = useMemo(() => (model === null ? null : entityView(model, id)), [model, id]);
  const places = useMemo(
    () => (model === null ? [] : placesOf(model, outlineOf(model, plan), id)),
    [model, plan, id],
  );
  if (model === null) return <p className={styles.note}>The plan could not be loaded.</p>;
  if (view === null) {
    return (
      <>
        <InspectorBar id={id} model={model} />
        <p className={styles.note}>The plan has nothing called {id}.</p>
      </>
    );
  }
  const showToday = today && !view.planLevel;
  return (
    <>
      <InspectorBar id={id} model={model} />
      {view.planLevel ? null : <ViewSwitch onChange={setToday} today={showToday} />}
      <div className={styles.body}>
        <EntityHead today={showToday} view={view} />
        <EntityDetails
          image={view.image === null ? null : assetUrl(planHref(plan), view.image)}
          model={model}
          today={showToday}
          view={view}
        />
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
