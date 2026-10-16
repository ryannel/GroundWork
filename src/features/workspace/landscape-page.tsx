import Link from 'next/link';
import type { ReactNode } from 'react';

import type { PlanCard } from '@/application/plan-footprint';
import type { Landscape, TeamRow } from '@/application/workspace-landscape';
import type { NavGroup } from '@/application/workspace-nav';
import { plural } from '@/shared/text';
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

function KeyJourneys({ landscape }: { readonly landscape: Landscape }) {
  const { key } = landscape;
  return (
    <section className={styles.section}>
      <SectionHeading title="Key journeys">
        <p>
          {key.source === 'code'
            ? 'Suggested from the code: together they reach the most systems, and a person starts them where one does. Name your own under key_journeys in workspace.yaml.'
            : 'The journeys this workspace leads with, named in workspace.yaml.'}{' '}
          Each domain and system lists every flow that runs through it.
        </p>
      </SectionHeading>
      {key.unknown.length === 0 ? null : (
        <Callout title="Some key journeys are not in the model">
          <p>
            workspace.yaml names {key.unknown.map((name) => `“${name}”`).join(', ')}, which no user
            journey or flow matches.
          </p>
        </Callout>
      )}
      <JourneyCards cards={key.cards} />
      <p className={styles.more}>
        <Link href={landscape.allJourneys}>
          All {plural(landscape.journeys.length, 'journey and flow', 'journeys and flows')} →
        </Link>
      </p>
    </section>
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

// The whole workspace: first what may change, then how it runs today, in the order a newcomer learns it: who uses
// which domain and how the domains connect, the key journeys, and the teams that run it.
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
      {plans === undefined ? null : (
        <section className={styles.plans}>
          <SectionHeading title="Plans">
            <p>What may change. Each plan shows its own picture of the systems after it lands.</p>
          </SectionHeading>
          <PlanCards plans={plans} />
        </section>
      )}
      {landscape.map.domains.length === 0 ? (
        <Empty folder={folder} />
      ) : (
        <>
          <section className={styles.section}>
            <SectionHeading title="Landscape">
              <p>
                Who uses the systems, the domains they sit in, and the outside services they rely
                on. Open a domain to see its systems, or light up a key journey to see the way it
                takes.
              </p>
            </SectionHeading>
            <LandscapeMap input={landscape.map} />
          </section>
          <KeyJourneys landscape={landscape} />
          <section className={styles.section}>
            <SectionHeading title="Teams">
              <p>Who runs which systems, and where to reach them.</p>
            </SectionHeading>
            <Teams teams={landscape.teams} />
          </section>
        </>
      )}
    </WorkspaceShell>
  );
}
