import type { ReactNode } from 'react';

import type { AreaLandscapeView } from '@/application/workspace-landscape-areas';
import type { NavGroup } from '@/application/workspace-nav';
import { Facts } from '@/ui/facts';
import { PageHeader } from '@/ui/page-header';
import { SectionHeading } from '@/ui/section-heading';

import styles from './area-landscape-page.module.css';
import { AreaLandscape } from './area-landscape.client';
import { WorkspaceShell } from './workspace-shell';

interface Props {
  readonly landscape: AreaLandscapeView;
  readonly nav: readonly NavGroup[];
  readonly overlays?: ReactNode;
  readonly actions?: ReactNode;
}

/** A purpose-led entrance into the company, with technical detail one selection away. */
export function AreaLandscapePage({ landscape, nav, overlays, actions }: Props) {
  return (
    <WorkspaceShell
      actions={actions}
      nav={nav}
      overlays={overlays}
      title={landscape.name}
      wide
      trail={[{ label: 'Workspaces', href: '/' }]}
    >
      <PageHeader
        description={landscape.headline}
        meta={<Facts items={landscape.facts} />}
        title={landscape.name}
      />
      <section className={styles.section}>
        <SectionHeading title="How the company works">
          {landscape.scope === '' ? null : <p>{landscape.scope}</p>}
        </SectionHeading>
        <AreaLandscape view={landscape} />
      </section>
    </WorkspaceShell>
  );
}
