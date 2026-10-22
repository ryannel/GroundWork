'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, use, useSyncExternalStore } from 'react';

import { thingByToken } from '@/application/plan-pages-things';
import type { Workspace } from '@/domain/workspace';
import type { Attribution } from '@/domain/workspace-model';
import { pendingJson, pendingModel } from '@/features/plan/plan-model';
import { Text } from '@/ui/text';

import { TodayThing } from './today-thing';

interface TodayThingViewProps {
  readonly workspace: Workspace;
  /** Where today's model is, relative to the page. */
  readonly modelSrc: string;
  /** Where today's attribution is, relative to the page. */
  readonly attributionSrc: string;
}

type Attributions = Readonly<Record<string, Attribution>>;

const NONE: Attributions = {};

// attribution.json is the build's own, so a look at its shape is enough.
const isAttributions = (value: unknown): value is Attributions =>
  typeof value === 'object' && value !== null;

function attributionOf(body: unknown): Attributions {
  if (typeof body !== 'object' || body === null || !('attribution' in body)) return NONE;
  const { attribution } = body;
  return isAttributions(attribution) ? attribution : NONE;
}

// The thing `?id=` names, drawn from today's model, with who said so and where in the code.
function TodayThingRead({ workspace, modelSrc, attributionSrc }: TodayThingViewProps) {
  const token = useSearchParams().get('id') ?? '';
  const model = use(pendingModel(modelSrc).model);
  const attribution = attributionOf(use(pendingJson(attributionSrc).json));
  if (model === null) {
    return (
      <Text as="p" tone="muted">
        How the systems work today could not be loaded.
      </Text>
    );
  }
  const id = thingByToken(model, token);
  if (id === null) {
    return (
      <Text as="p" tone="muted">
        Nothing here goes by that name.
      </Text>
    );
  }
  return (
    <TodayThing attribution={attribution} id={id} key={id} model={model} workspace={workspace} />
  );
}

function ignore(): void {
  // Nothing to stop: the answer never changes once in the browser.
}

function still(): () => void {
  return ignore;
}

/** Today's one page for its things: the thing `?id=` names, drawn in the browser. */
export function TodayThingView(props: TodayThingViewProps) {
  // The model is fetched from beside the page, an address only the browser knows, so the server draws the wait.
  const inBrowser = useSyncExternalStore(
    still,
    () => true,
    () => false,
  );
  const loading = (
    <Text as="p" tone="muted">
      Loading…
    </Text>
  );
  return (
    <Suspense fallback={loading}>{inBrowser ? <TodayThingRead {...props} /> : loading}</Suspense>
  );
}
