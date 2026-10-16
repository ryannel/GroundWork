import Link from 'next/link';
import type { ReactNode } from 'react';

import type { Model } from '@/application/plan/derive';
import { typeOf } from '@/application/plan/ids';
import { entityView, type EntityGroup, type EntityView } from '@/application/plan-pages-entity';
import { siblingsOf, thingAt } from '@/application/plan-pages-things';
import { assetUrl } from '@/application/plan-viz-screens';
import { todayReaderOf } from '@/application/today-reader';
import { codeEvidenceOf, todayPlaceOf, type TodayPlace } from '@/application/today-thing';
import { workspaceHref } from '@/application/workspace-paths';
import { TYPE_WORDS } from '@/domain/plan/plan-vocab';
import type { Workspace } from '@/domain/workspace';
import type { Attribution } from '@/domain/workspace-model';
import { CopyLink } from '@/features/plan/inspector/copy-link.client';
import { EntityDetails, EntityGroups } from '@/features/plan/inspector/entity-details';
import { EntityHead } from '@/features/plan/inspector/entity-head';
import { EntityPlaces } from '@/features/plan/inspector/entity-places';
import { ThingExtras } from '@/features/plan/inspector/thing-extras';
import { ThingRegister } from '@/features/plan/thing-page/thing-register';

import { TodayEvidence } from './today-evidence';
import styles from './today-thing.module.css';

interface TodayThingProps {
  readonly workspace: Workspace;
  readonly model: Model;
  /** Who said each fact and where in the code, by id. */
  readonly attribution: Readonly<Record<string, Attribution>>;
  readonly id: string;
}

const FLOW_GROUPS = new Set(['Flows that use it', 'Steps that use it']);

function Place({ place, base }: { readonly place: TodayPlace; readonly base: string }) {
  return (
    <nav aria-label="Where it sits" className={styles.place}>
      <Link href={place.domain.href}>{place.domain.label}</Link>
      <span aria-hidden="true">›</span>
      <Link href={place.system.href}>{place.system.label}</Link>
      {place.component === null ? null : (
        <>
          <span aria-hidden="true">›</span>
          <Link href={thingAt(base, place.component.id)}>{place.component.name}</Link>
        </>
      )}
    </nav>
  );
}

function Section({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>{title}</h2>
      {children}
    </section>
  );
}

function TopLine({
  back,
  place,
}: {
  readonly back: { label: string; href: string };
  readonly place: string;
}) {
  return (
    <div className={styles.top}>
      <Link className={styles.back} href={back.href}>
        ← Back to {back.label}
      </Link>
      <span className={styles.count}>{place}</span>
      <CopyLink label="Copy a link to this page" />
    </div>
  );
}

const split = (view: EntityView) => {
  const links: EntityGroup[] = [
    ...view.uses,
    ...view.usedBy.filter((g) => !FLOW_GROUPS.has(g.label)),
  ];
  const flows = view.usedBy.filter((g) => FLOW_GROUPS.has(g.label));
  return { links, flows };
};

/** One thing of today on a page of its own: what it means, where it sits, what it talks to, the flows that use
 * it and the code that says so. Null for no such thing. Put it inside WorkspaceShell. */
export function TodayThing({ workspace, model, attribution, id }: TodayThingProps) {
  const view = entityView(model, id);
  const type = typeOf(id);
  if (view === null || type === null) return null;
  const reader = todayReaderOf(workspace.id, 2);
  const place = todayPlaceOf(workspace, model, id);
  const siblings = siblingsOf(model, id);
  const { links, flows } = split(view);
  const back = place?.system ?? { label: 'the landscape', href: workspaceHref(workspace.id) };
  const count = `${TYPE_WORDS[type]} ${String(siblings.indexOf(id) + 1)} of ${String(siblings.length)}`;
  return (
    <>
      <TopLine back={back} place={count.charAt(0).toUpperCase() + count.slice(1)} />
      <div className={styles.layout}>
        <ThingRegister
          base={reader.thingBase}
          id={id}
          model={model}
          siblings={siblings}
          title={`Every ${TYPE_WORDS[type]}`}
        />
        <article className={styles.article}>
          <EntityHead heading="h1" today view={view} />
          {place === null ? null : <Place base={reader.thingBase} place={place} />}
          <EntityDetails
            image={view.image === null ? null : assetUrl(reader.assetBase, view.image)}
            model={model}
            today
            view={{ ...view, uses: [], usedBy: [] }}
          />
          {links.length === 0 ? null : (
            <Section title="What it works with">
              <EntityGroups groups={links} />
            </Section>
          )}
          <ThingExtras id={id} model={model} today />
          {flows.length === 0 ? null : (
            <Section title="Where it takes part">
              <EntityGroups groups={flows} />
            </Section>
          )}
          <Section title="In the code">
            <TodayEvidence
              evidence={codeEvidenceOf(attribution, id)}
              id={id}
              model={model}
              sources={view.sources}
            />
          </Section>
          <EntityPlaces
            here=""
            mentionedIn={view.mentionedIn}
            mentionedParts={[]}
            places={[]}
            sources={[]}
          />
        </article>
      </div>
    </>
  );
}
