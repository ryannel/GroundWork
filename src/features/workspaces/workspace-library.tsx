import type { Library } from '@/application/workspace-library';
import { AppBar } from '@/ui/app-bar';
import { AppShell } from '@/ui/app-shell';
import { Callout } from '@/ui/callout';
import { PageHeader } from '@/ui/page-header';
import { Text } from '@/ui/text';

import styles from './workspace-library.module.css';
import { WorkspacePanel } from './workspace-panel';

interface WorkspaceLibraryProps {
  readonly library: Library;
}

export function WorkspaceLibrary({ library }: WorkspaceLibraryProps) {
  const linked = library.cards.filter((card) => !card.isExample);
  const pending = library.pending ?? [];
  const examples = library.cards.filter((card) => card.isExample);
  return (
    <AppShell bar={<AppBar title="Workspaces" />}>
      <PageHeader
        description="Each workspace holds today's systems and the plans that change them. Examples are listed separately."
        title="Workspaces"
      />
      {linked.length === 0 && pending.length === 0 ? (
        <div className={styles.empty}>
          <Text as="p" tone="muted">
            No workspaces linked. In the Groundwork checkout, run{' '}
            <code>npm run workspace -- add &lt;folder or repo URL&gt;</code>, then reload this page.
          </Text>
        </div>
      ) : null}
      {pending.length === 0 ? null : (
        <Callout title="Workspaces awaiting consolidation">
          <Text as="p">
            These workspaces are registered. Their consolidated models are not available yet.
          </Text>
          <ul>
            {pending.map((workspace) => (
              <li key={workspace.id}>{workspace.name}</li>
            ))}
          </ul>
        </Callout>
      )}
      <ul aria-label="Linked workspaces" className={styles.list}>
        {linked.map((card) => (
          <li key={card.id}>
            <WorkspacePanel card={card} />
          </li>
        ))}
      </ul>
      {examples.length === 0 ? null : (
        <section aria-labelledby="workspace-examples" className={styles.examples}>
          <h2 id="workspace-examples">Examples</h2>
          <p>Bundled examples show how Groundwork works. They are not your company&apos;s model.</p>
          <ul aria-label="Example workspaces" className={styles.list}>
            {examples.map((card) => (
              <li key={card.id}>
                <WorkspacePanel card={card} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </AppShell>
  );
}
