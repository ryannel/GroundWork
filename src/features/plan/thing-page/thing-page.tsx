import { Suspense } from 'react';

import type { Model } from '@/application/plan/derive';
import type { PlanCard } from '@/application/plan-footprint';
import { planHref, type Outline, type Page } from '@/application/plan-pages';
import { THINGS_SCREEN } from '@/application/plan-pages-things';
import { planJsonOf } from '@/features/plan/plan-model';
import { PlanShell } from '@/features/plan/plan-shell';
import { Text } from '@/ui/text';

import { PlanThing } from './plan-thing.client';

interface ThingPageProps {
  readonly model: Model;
  readonly outline: Outline;
  readonly workspaceName: string;
  readonly plans: readonly PlanCard[];
}

/** The plan's one page for its things: the shell, drawn at build time, and the thing `?id=` names, drawn in the
 * browser. */
export function ThingPage({ model, outline, workspaceName, plans }: ThingPageProps) {
  const page: Page = {
    chapter: 'ref',
    screen: THINGS_SCREEN,
    title: 'Things',
    href: `${planHref(outline)}things/`,
  };
  return (
    <PlanShell
      model={model}
      neighbours={null}
      outline={outline}
      page={page}
      plans={plans}
      workspaceName={workspaceName}
    >
      <Suspense
        fallback={
          <Text as="p" tone="muted">
            Loading…
          </Text>
        }
      >
        <PlanThing outline={outline} src={planJsonOf(page)} />
      </Suspense>
    </PlanShell>
  );
}
