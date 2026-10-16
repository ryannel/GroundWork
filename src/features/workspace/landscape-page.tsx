import Link from 'next/link';
import type { ReactNode } from 'react';

import type { PlanCard } from '@/application/plan-footprint';
import type { Landscape, TeamRow } from '@/application/workspace-landscape';
import type { NavGroup } from '@/application/workspace-nav';
import { Callout } from '@/ui/callout';
import { Facts } from '@/ui/facts';
import { PageHeader } from '@/ui/page-header';
import { SectionHeading } from '@/ui/section-heading';

import { JourneyCards } from './journey-cards';
import { LandscapeMap } from './landscape-map.client';
import styles from './landscape-page.module.css';
import { PlanCards } from './plan-parts';
import { WorkspaceShell } from './workspace-shell';

interface LandscapePageProps {
  readonly landscape: Landscape;
  readonly folder: string;
  readonly nav: readonly NavGroup[];
  /** The workspace's plans; leave out and the section is not drawn. */
  readonly plans?: readonly PlanCard[];
  /** What floats over the page: the inspector, the palette, the keys. */
  readonly overlays?: ReactNode;
  readonly actions?: ReactNode;
}

function Teams({ teams }: { readonly teams: readonly TeamRow[] }) {
  return (
    <ul className={styles.teams}>
      {teams.map((team) => (
        <li className={styles.team} key={team.id}>
          <span className={styles.who}>
            <span className={styles.dot} data-team={team.slot} />
            {team.name}
          </span>
          <span className={styles.runs}>
            {team.systems.map((system) => (
              <Link className={styles.system} href={system.href} key={system.href}>
                {system.name}
              </Link>
            ))}
          </span>
          <span className={styles.channel}>{team.channel}</span>
        </li>
      ))}
    </ul>
  );
}

function Empty({ folder }: { readonly folder: string }) {
  return (
    <Callout title="No domains yet">
      <p>
        Add a domain as a folder with a <code>domain.yaml</code> under{' '}
        <code>workspaces/{folder}/domains/</code>, then its systems under <code>systems/</code>.
      </p>
    </Callout>
  );
}

// The whole workspace, in the order a newcomer learns it: who uses which domain and how the domains connect, the
// journeys that carry the work, the teams that run it, and, set apart, what may change.
export function LandscapePage(props: LandscapePageProps) {
  const { landscape, folder, nav, plans, overlays, actions } = props;
  return (
    <WorkspaceShell
      actions={actions}
      nav={nav}
      overlays={overlays}
      title={landscape.name}
      trail={[{ label: 'Workspaces', href: '/' }]}
    >
      <PageHeader
        description={landscape.headline}
        meta={<Facts items={landscape.facts} />}
        title={landscape.name}
      />
      {landscape.map.domains.length === 0 ? (
        <Empty folder={folder} />
      ) : (
        <>
          <section className={styles.section}>
            <SectionHeading title="Landscape">
              <p>
                Who uses the systems, the domains they sit in, and the outside services they rely
                on. Open a domain to see its systems, or light up a journey to see the way it takes.
              </p>
            </SectionHeading>
            <LandscapeMap input={landscape.map} />
          </section>
          <section className={styles.section}>
            <SectionHeading title="Journeys">
              <p>
                How work moves across the systems, from what sets it off to how it ends. Open one to
                walk it.
              </p>
            </SectionHeading>
            <JourneyCards cards={landscape.journeys} />
          </section>
          <section className={styles.section}>
            <SectionHeading title="Teams">
              <p>Who runs which systems, and where to reach them.</p>
            </SectionHeading>
            <Teams teams={landscape.teams} />
          </section>
        </>
      )}
      {plans === undefined ? null : (
        <section className={styles.apart}>
          <SectionHeading title="Plans">
            <p>What may change. Each plan shows its own picture of the systems after it lands.</p>
          </SectionHeading>
          <PlanCards plans={plans} />
        </section>
      )}
    </WorkspaceShell>
  );
}
