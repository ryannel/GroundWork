import type { Library } from '@/application/workspace-library';
import { AppBar } from '@/ui/app-bar';
import { PageHeader } from '@/ui/page-header';

import styles from './workspace-library.module.css';
import { WorkspacePanel } from './workspace-panel';

interface WorkspaceLibraryProps {
  readonly library: Library;
}

export function WorkspaceLibrary({ library }: WorkspaceLibraryProps) {
  return (
    <>
      <AppBar />
      <main className={styles.page}>
        <PageHeader
          description="Each workspace holds the systems a company runs and the plans that change them."
          title="Workspaces"
        />
        <ul className={styles.list}>
          {library.cards.map((card) => (
            <li key={card.id}>
              <WorkspacePanel card={card} />
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
