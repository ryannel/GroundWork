import Link from 'next/link';

import type { NavGroup } from '@/application/workspace-nav';
import type { ComponentRow, SystemView } from '@/application/workspace-system';
import { Badge } from '@/ui/badge';
import { Card } from '@/ui/card';
import { DataTable } from '@/ui/data-table';
import { Facts } from '@/ui/facts';
import { Legend } from '@/ui/legend';
import { PageHeader } from '@/ui/page-header';
import { SectionHeading } from '@/ui/section-heading';

import { Diagram } from './diagram';
import styles from './system-page.module.css';
import { WorkspaceShell } from './workspace-shell';

// One plan's part for this system: the work items going to its repos.
interface PlanPart {
  readonly id: string;
  readonly title: string;
  readonly href: string;
  readonly workItems: number;
  readonly done: number;
}

interface SystemPageProps {
  readonly view: SystemView;
  readonly nav: readonly NavGroup[];
  /** The plans landing on this system; leave out until plans are read, and the section is not drawn. */
  readonly parts?: readonly PlanPart[];
}

export function SystemPage({ view, nav, parts }: SystemPageProps) {
  return (
    <WorkspaceShell
      nav={nav}
      title={view.name}
      trail={[{ label: 'Workspaces', href: '/' }, ...view.trail]}
    >
      <PageHeader
        description={view.description}
        title={view.name}
        meta={
          <Facts items={view.facts}>
            {view.repos.map((repo) => (
              <code key={repo}>{repo}</code>
            ))}
          </Facts>
        }
      />
      {parts === undefined ? null : <Plans parts={parts} />}
      <section className={styles.section}>
        <SectionHeading title="Connections">
          <p>Systems that call in are on the left, the ones it calls on the right.</p>
        </SectionHeading>
        <Diagram
          diagram={view.diagram}
          label={`The components of ${view.name} and their connections`}
        />
        <Legend
          items={[
            { line: 'solid', label: 'call or message' },
            { line: 'dashed', label: 'outside this system' },
          ]}
        />
      </section>
      <section className={styles.section}>
        <SectionHeading title="Components">
          <p>What each component does and what it talks to.</p>
        </SectionHeading>
        <DataTable
          caption="Components"
          captionHidden
          columns={[
            { key: 'component', label: 'Component' },
            { key: 'type', label: 'Type' },
            { key: 'does', label: 'Does' },
            { key: 'talksTo', label: 'Talks to' },
          ]}
          rows={view.components.map((component) => ({
            key: component.id,
            cells: {
              component: (
                <>
                  {component.name} <code className={styles.id}>{component.id}</code>
                </>
              ),
              type:
                component.tech === null ? component.type : `${component.type} · ${component.tech}`,
              does: component.does ?? '',
              talksTo: <TalksTo component={component} />,
            },
          }))}
        />
      </section>
    </WorkspaceShell>
  );
}

function TalksTo({ component }: { readonly component: ComponentRow }) {
  if (component.talksTo.length === 0) return <span className={styles.none}>Nothing</span>;
  return (
    <ul className={styles.targets}>
      {component.talksTo.map((target, index) => (
        <li key={`${target.label}-${target.via}-${String(index)}`}>
          {target.href === null ? target.label : <Link href={target.href}>{target.label}</Link>}{' '}
          <Badge>{target.via}</Badge>
        </li>
      ))}
    </ul>
  );
}

function Plans({ parts }: { readonly parts: readonly PlanPart[] }) {
  return (
    <section className={styles.section}>
      <SectionHeading title="Plans">
        <p>Plans whose changes or work items land on this system.</p>
      </SectionHeading>
      {parts.length === 0 ? (
        <p className={styles.empty}>No plan changes this system.</p>
      ) : (
        <ul className={styles.plans}>
          {parts.map((part) => (
            <li key={part.id}>
              <Card href={part.href} title={part.title}>
                <Badge tone="accent">
                  {part.workItems === 0
                    ? 'Changes here, no work items yet'
                    : `${String(part.done)} of ${String(part.workItems)} work items done`}
                </Badge>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
