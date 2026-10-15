import Link from 'next/link';

import type { DomainView } from '@/application/workspace-domain';
import type { NavGroup } from '@/application/workspace-nav';
import { DataTable } from '@/ui/data-table';
import { Facts } from '@/ui/facts';
import { Legend } from '@/ui/legend';
import { PageHeader } from '@/ui/page-header';
import { SectionHeading } from '@/ui/section-heading';

import { Diagram } from './diagram';
import styles from './domain-page.module.css';
import { WorkspaceShell } from './workspace-shell';

interface DomainPageProps {
  readonly view: DomainView;
  readonly nav: readonly NavGroup[];
}

export function DomainPage({ view, nav }: DomainPageProps) {
  return (
    <WorkspaceShell
      nav={nav}
      title={view.name}
      trail={[
        { label: 'Workspaces', href: '/' },
        { label: view.workspace.name, href: view.workspace.href },
      ]}
    >
      <PageHeader
        description={view.description}
        title={view.name}
        meta={<Facts items={view.facts} />}
      />
      <section className={styles.section}>
        <SectionHeading title="Connections">
          <p>Systems in other domains are drawn faded. Open any system by its box.</p>
        </SectionHeading>
        <Diagram
          diagram={view.diagram}
          label={`The systems in ${view.name} and what they talk to`}
        />
        <Legend
          items={[
            { line: 'solid', label: 'call or message' },
            { line: 'dashed', label: 'outside this domain' },
          ]}
        />
      </section>
      <section className={styles.section}>
        <SectionHeading title="Systems">
          <p>Who owns each system and how many components it has.</p>
        </SectionHeading>
        <DataTable
          caption="Systems"
          captionHidden
          columns={[
            { key: 'system', label: 'System' },
            { key: 'team', label: 'Team' },
            { key: 'components', label: 'Components' },
          ]}
          rows={view.systems.map((system) => ({
            key: system.id,
            cells: {
              system: <Link href={system.href}>{system.name}</Link>,
              team: system.team,
              components: system.components,
            },
          }))}
        />
      </section>
    </WorkspaceShell>
  );
}
