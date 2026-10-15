import Link from 'next/link';

import type { DomainView } from '@/application/workspace-domain';
import { AppBar } from '@/ui/app-bar';
import { DataTable } from '@/ui/data-table';
import { Facts } from '@/ui/facts';
import { PageHeader } from '@/ui/page-header';
import { SectionHeading } from '@/ui/section-heading';

import { Diagram } from './diagram';
import styles from './domain-page.module.css';

interface DomainPageProps {
  readonly view: DomainView;
}

export function DomainPage({ view }: DomainPageProps) {
  return (
    <>
      <AppBar />
      <main className={styles.page}>
        <PageHeader
          description={view.description}
          title={view.name}
          trail={[
            { label: 'Workspaces', href: '/' },
            { label: view.workspace.name, href: view.workspace.href },
          ]}
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
        </section>
        <section className={styles.section}>
          <DataTable
            caption="Systems"
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
      </main>
    </>
  );
}
