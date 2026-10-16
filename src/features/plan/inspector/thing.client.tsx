'use client';

import { usePathname } from 'next/navigation';
import { use, useMemo, useState, useTransition } from 'react';

import type { Model } from '@/application/plan/derive';
import { outlineOf } from '@/application/plan-pages';
import { entityView } from '@/application/plan-pages-entity';
import { placesOf, type EntityPlace } from '@/application/plan-pages-entity-where';
import { thingAt, topThingIds } from '@/application/plan-pages-things';
import { assetUrl } from '@/application/plan-viz-screens';
import type { Reader } from '@/application/today-reader';
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
  /** Where the model is and where its pages and pictures are; a plan's reader also names the plan. */
  readonly reader: Reader;
}

interface ThingViewProps {
  readonly id: string;
  readonly model: Model;
  readonly reader: Reader;
  /** The version it is shown at, null for the one being read. */
  readonly version: string | null;
}

const placesIn = (model: Model, reader: Reader, id: string): EntityPlace[] =>
  reader.plan === undefined ? [] : placesOf(model, outlineOf(model, reader.plan), id);

function missing(reader: Reader, version: string | null, id: string): string {
  if (reader.mode === 'today') return `Nothing called ${id} runs today.`;
  const where = version === null ? 'The plan has' : `Version ${version} had`;
  return `${where} nothing called ${id}.`;
}

// The thing as it is today or with the plan, then where the story tells it. Today's reader has only today.
function ThingView({ id, model, reader, version }: ThingViewProps) {
  const [today, setToday] = useState(false);
  const routed: unknown = usePathname();
  const here = typeof routed === 'string' ? routed : '';
  const view = useMemo(() => entityView(model, id), [model, id]);
  const places = useMemo(() => placesIn(model, reader, id), [model, reader, id]);
  if (view === null) return <p className={styles.note}>{missing(reader, version, id)}</p>;
  const switchable = reader.mode === 'plan' && !view.planLevel;
  const showToday = reader.mode === 'today' || (today && switchable);
  return (
    <>
      {switchable ? <ViewSwitch onChange={setToday} today={showToday} /> : null}
      <div className={styles.body}>
        <EntityHead today={showToday} view={view} />
        <EntityDetails
          image={view.image === null ? null : assetUrl(reader.assetBase, view.image)}
          model={model}
          today={showToday}
          view={view}
        />
        <ThingExtras id={id} model={model} today={showToday} />
        <EntityPlaces
          here={here}
          mentionedIn={view.mentionedIn}
          mentionedParts={reader.mode === 'today' ? [] : view.mentionedParts}
          places={places}
          sources={view.sources}
        />
      </div>
    </>
  );
}

// What the inspector shows for one id: the bar, the version it is read at, then the thing. A new id remounts it,
// so the switch starts on the plan, at the version being read, each time. Today has no versions.
export function Thing({ id, reader }: ThingProps) {
  const head = use(pendingModel(reader.modelSrc).model);
  const [version, setVersion] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const shown =
    version === null ? head : use(pendingModel(revisionSrc(reader.modelSrc, version)).model);
  const page = useMemo(
    () => (head !== null && topThingIds(head).includes(id) ? thingAt(reader.thingBase, id) : null),
    [head, reader.thingBase, id],
  );
  if (head === null) {
    const what = reader.mode === 'plan' ? 'The plan' : 'How the systems work today';
    return <p className={styles.note}>{`${what} could not be loaded.`}</p>;
  }
  const jump = (next: string | null): void => {
    startTransition(() => {
      setVersion(next);
    });
  };
  return (
    <>
      <InspectorBar id={id} model={head} page={page} />
      {reader.mode === 'plan' ? <VersionJump model={head} onChange={jump} value={version} /> : null}
      {shown === null ? (
        <p className={styles.note}>{`No copy of version ${version ?? ''} was kept.`}</p>
      ) : (
        <ThingView id={id} key={version ?? ''} model={shown} reader={reader} version={version} />
      )}
    </>
  );
}
