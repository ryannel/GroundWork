import Link from 'next/link';

import type { Model } from '@/application/plan/derive';
import type { PlanCard } from '@/application/plan-footprint';
import { planHref, type Outline, type Page } from '@/application/plan-pages';
import { entityView, type EntityView } from '@/application/plan-pages-entity';
import { placesOf } from '@/application/plan-pages-entity-where';
import { siblingsOf, thingHome, thingHref, thingNeighbours } from '@/application/plan-pages-things';
import { assetUrl } from '@/application/plan-viz-screens';
import { CopyLink } from '@/features/plan/inspector/copy-link.client';
import { EntityDetails } from '@/features/plan/inspector/entity-details';
import { EntityHead } from '@/features/plan/inspector/entity-head';
import { EntityPlaces } from '@/features/plan/inspector/entity-places';
import { ThingExtras } from '@/features/plan/inspector/thing-extras';
import { PlanShell } from '@/features/plan/plan-shell';

import styles from './thing-page.module.css';
import { ThingRegister } from './thing-register';
import { ThingViews } from './thing-views.client';

interface ThingPageProps {
  readonly model: Model;
  readonly outline: Outline;
  readonly workspaceName: string;
  readonly plans?: readonly PlanCard[];
  readonly id: string;
}

interface SheetProps {
  readonly model: Model;
  readonly outline: Outline;
  readonly view: EntityView;
  readonly today: boolean;
}

function Sheet({ model, outline, view, today }: SheetProps) {
  return (
    <div className={styles.sheet}>
      <EntityHead heading="h1" today={today} view={view} />
      <EntityDetails
        image={view.image === null ? null : assetUrl(planHref(outline), view.image)}
        model={model}
        today={today}
        view={view}
      />
      <ThingExtras id={view.id} model={model} today={today} />
      <EntityPlaces
        here={thingHref(outline, view.id)}
        mentionedIn={view.mentionedIn}
        mentionedParts={view.mentionedParts}
        places={placesOf(model, outline, view.id)}
        sources={view.sources}
      />
    </div>
  );
}

const capital = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1);

function TopLine({ home, place }: { readonly home: Page | null; readonly place: string }) {
  const back = home?.chapter === 'ref' ? `Back to ${home.title}` : 'Back to the plan';
  return (
    <div className={styles.top}>
      {home === null ? null : (
        <Link className={styles.back} href={home.href}>
          ← {back}
        </Link>
      )}
      <span className={styles.place}>{place}</span>
      <CopyLink label="Copy a link to this page" />
    </div>
  );
}

/** One thing on a page of its own: what the inspector shows, beside the others of its kind. Null for no such thing. */
export function ThingPage({ model, outline, workspaceName, plans = [], id }: ThingPageProps) {
  const view = entityView(model, id);
  if (view === null) return null;
  const home = thingHome(outline, id);
  const page: Page = {
    chapter: 'ref',
    screen: home?.screen ?? 'things',
    title: view.name,
    href: thingHref(outline, id),
  };
  const siblings = siblingsOf(model, id);
  const place = `${capital(view.type)} ${String(siblings.indexOf(id) + 1)} of ${String(siblings.length)}`;
  const sheet = (today: boolean) => (
    <Sheet model={model} outline={outline} today={today} view={view} />
  );
  return (
    <PlanShell
      model={model}
      neighbours={thingNeighbours(model, outline, id)}
      outline={outline}
      page={page}
      plans={plans}
      workspaceName={workspaceName}
    >
      <TopLine home={home} place={place} />
      <div className={styles.layout}>
        <ThingRegister
          id={id}
          model={model}
          outline={outline}
          siblings={siblings}
          title={home?.chapter === 'ref' ? home.title : capital(view.type)}
        />
        <article className={styles.article}>
          <ThingViews today={view.planLevel ? null : sheet(true)} withPlan={sheet(false)} />
        </article>
      </div>
    </PlanShell>
  );
}
