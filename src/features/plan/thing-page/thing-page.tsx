import type { Model } from '@/application/plan/derive';
import type { PlanCard } from '@/application/plan-footprint';
import { planHref, type Outline, type Page } from '@/application/plan-pages';
import { THINGS_SCREEN, thingByToken, thingNeighbours } from '@/application/plan-pages-things';
import { PlanKeys } from '@/features/plan/keys.client';
import { Pager } from '@/features/plan/pager.client';
import { PlanShell } from '@/features/plan/plan-shell';
import { Text } from '@/ui/text';

import { ThingBody } from './thing-body';

interface ThingPageProps {
  readonly model: Model;
  readonly outline: Outline;
  readonly workspaceName: string;
  readonly plans: readonly PlanCard[];
  /** The `?id=` of the address: the thing to draw. */
  readonly token: string;
}

function Thing({ model, outline, token }: Pick<ThingPageProps, 'model' | 'outline' | 'token'>) {
  const id = thingByToken(model, token);
  if (id === null) {
    return (
      <Text as="p" tone="muted">
        This plan has nothing by that name.
      </Text>
    );
  }
  const neighbours = thingNeighbours(model, outline, id);
  return (
    <>
      <ThingBody id={id} model={model} outline={outline} />
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

/** The plan's one page for its things: the thing `?id=` names, with the pager and the keys stepping along its
 * kind. */
export function ThingPage({ model, outline, workspaceName, plans, token }: ThingPageProps) {
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
      <Thing model={model} outline={outline} token={token} />
    </PlanShell>
  );
}
