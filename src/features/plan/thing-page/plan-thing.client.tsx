'use client';

import { useSearchParams } from 'next/navigation';
import { use } from 'react';

import type { Outline } from '@/application/plan-pages';
import { thingByToken, thingNeighbours } from '@/application/plan-pages-things';
import { PlanKeys } from '@/features/plan/keys.client';
import { Pager } from '@/features/plan/pager.client';
import { pendingModel } from '@/features/plan/plan-model';
import { Text } from '@/ui/text';

import { ThingBody } from './thing-body';

function Note({ children }: { readonly children: string }) {
  return (
    <Text as="p" tone="muted">
      {children}
    </Text>
  );
}

interface PlanThingProps {
  readonly outline: Outline;
  /** Where the plan's model is, relative to the page. */
  readonly src: string;
}

// The thing `?id=` names, drawn from the plan's model, with the pager and the keys stepping along its kind.
export function PlanThing({ outline, src }: PlanThingProps) {
  const token = useSearchParams().get('id') ?? '';
  const model = use(pendingModel(src).model);
  if (model === null) return <Note>The plan could not be loaded.</Note>;
  const id = thingByToken(model, token);
  if (id === null) return <Note>This plan has nothing by that name.</Note>;
  const neighbours = thingNeighbours(model, outline, id);
  return (
    <>
      <ThingBody id={id} key={id} model={model} outline={outline} />
      <Pager neighbours={neighbours} />
      <PlanKeys
        next={neighbours.next?.href ?? null}
        nextChapter={null}
        previous={neighbours.previous?.href ?? null}
        previousChapter={null}
      />
    </>
  );
}
