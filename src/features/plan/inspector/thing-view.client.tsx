'use client';

import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';

import type { Model } from '@/application/plan/derive';
import { outlineOf } from '@/application/plan-pages';
import { entityView } from '@/application/plan-pages-entity';
import { placesOf, type EntityPlace } from '@/application/plan-pages-entity-where';
import { assetUrl } from '@/application/plan-viz-screens';
import type { Reader } from '@/application/today-reader';

import { EntityDetails } from './entity-details';
import { EntityHead } from './entity-head';
import { EntityPlaces } from './entity-places';
import { ThingExtras } from './thing-extras';
import styles from './thing-view.module.css';
import { ViewSwitch } from './view-switch.client';

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
export function ThingView({ id, model, reader, version }: ThingViewProps) {
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
