import type { ReactNode } from 'react';

import type { Landscape } from '@/application/workspace-landscape';
import type { NavGroup } from '@/application/workspace-nav';
import { Callout } from '@/ui/callout';
import { Facts } from '@/ui/facts';
import { PageHeader } from '@/ui/page-header';
import { SectionHeading } from '@/ui/section-heading';

import { LandscapeMap } from './landscape-map.client';
import styles from './landscape-page.module.css';
import { WorkspaceShell } from './workspace-shell';

interface LandscapePageProps {
  readonly landscape: Landscape;
  readonly nav: readonly NavGroup[];
  /** What floats over the page: the inspector, the palette, the keys. */
  readonly overlays?: ReactNode;
  readonly actions?: ReactNode;
}

function Empty() {
  return (
    <Callout title="No domains yet">
      <p>
        Add each domain to the workspace&apos;s repo as{' '}
        <code>domains/&lt;domain&gt;/domain.yaml</code>, and its systems under <code>systems/</code>
        , or ask an agent to sketch them from your code with the <code>groundwork-workspace</code>{' '}
        skill.
      </p>
    </Callout>
  );
}

// The whole workspace at its most zoomed out: the customer, every domain with the people who work in it, and
// how the domains rely on each other.
export function LandscapePage({ landscape, nav, overlays, actions }: LandscapePageProps) {
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
        <Empty />
      ) : (
        <section className={styles.section}>
          <SectionHeading title="Map">
            <p>
              The customer on the left, then the domains they use, then the domains those rely on.
              The people in each domain sit inside it; pick one to see their journeys.
            </p>
          </SectionHeading>
          <LandscapeMap drawing={landscape.drawing} map={landscape.map} />
        </section>
      )}
    </WorkspaceShell>
  );
}
