import Link from 'next/link';

import type { Model } from '@/application/plan/derive';
import { planHref, type Outline, type Page } from '@/application/plan-pages';
import { entityView, type EntityView } from '@/application/plan-pages-entity';
import { placesOf } from '@/application/plan-pages-entity-where';
import { siblingsOf, thingHome, thingHref } from '@/application/plan-pages-things';
import { assetUrl } from '@/application/plan-viz-screens';
import { CopyLink } from '@/features/plan/inspector/copy-link.client';
import { EntityDetails } from '@/features/plan/inspector/entity-details';
import { EntityHead } from '@/features/plan/inspector/entity-head';
import { EntityPlaces } from '@/features/plan/inspector/entity-places';
import { ThingExtras } from '@/features/plan/inspector/thing-extras';

import styles from './thing-body.module.css';
import { ThingRegister } from './thing-register';
import { ThingViews } from './thing-views.client';

interface ThingBodyProps {
  readonly model: Model;
  readonly outline: Outline;
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

/** One thing on a page of its own: what the inspector shows, beside the others of its kind. Null for no such
 * thing. The browser draws it, inside the plan's shell, from the model it fetched. */
export function ThingBody({ model, outline, id }: ThingBodyProps) {
  const view = entityView(model, id);
  if (view === null) return null;
  const home = thingHome(outline, id);
  const siblings = siblingsOf(model, id);
  const place = `${capital(view.type)} ${String(siblings.indexOf(id) + 1)} of ${String(siblings.length)}`;
  const sheet = (today: boolean) => (
    <Sheet model={model} outline={outline} today={today} view={view} />
  );
  return (
    <>
      <TopLine home={home} place={place} />
      <div className={styles.layout}>
        <ThingRegister
          id={id}
          model={model}
          base={`${planHref(outline)}things/`}
          siblings={siblings}
          title={home?.chapter === 'ref' ? home.title : capital(view.type)}
        />
        <article className={styles.article}>
          <ThingViews today={view.planLevel ? null : sheet(true)} withPlan={sheet(false)} />
        </article>
      </div>
    </>
  );
}
