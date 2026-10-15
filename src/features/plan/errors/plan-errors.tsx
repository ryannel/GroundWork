import Link from 'next/link';

import { workspaceHref } from '@/application/workspace-paths';
import { AppBar } from '@/ui/app-bar';
import { AppShell } from '@/ui/app-shell';
import { PageHeader } from '@/ui/page-header';

import styles from './plan-errors.module.css';

interface Problem {
  readonly path: string;
  readonly message: string;
}

interface PlanErrorsProps {
  readonly workspace: string;
  readonly workspaceName: string;
  readonly slug: string;
  readonly title: string | null;
  readonly errors: readonly Problem[];
  readonly warnings: readonly Problem[];
}

const SHOWN = 60;

function headline(count: number): string {
  if (count === 0) return 'This plan could not be opened';
  const word = count === 1 ? 'error' : 'errors';
  return `This plan has ${String(count)} ${word} and cannot be shown yet`;
}

function ProblemList({ errors, warnings }: Pick<PlanErrorsProps, 'errors' | 'warnings'>) {
  const all = [
    ...errors.map((p) => ({ ...p, level: 'error' })),
    ...warnings.map((p) => ({ ...p, level: 'warning' })),
  ];
  const shown = all.slice(0, SHOWN);
  return (
    <>
      <ul className={styles.list}>
        {shown.map((p, i) => (
          <li className={styles.item} data-level={p.level} key={`${p.path}-${String(i)}`}>
            <code className={styles.path}>{p.path}</code>
            <span className={styles.level}>{p.level}</span>
            <span className={styles.message}>{p.message}</span>
          </li>
        ))}
      </ul>
      {all.length > shown.length ? (
        <p className={styles.more}>And {String(all.length - shown.length)} more.</p>
      ) : null}
    </>
  );
}

/** A plan that failed its checks: what is wrong and where, in place of the plan. */
export function PlanErrors({
  workspace,
  workspaceName,
  slug,
  title,
  ...problems
}: PlanErrorsProps) {
  const home = workspaceHref(workspace);
  return (
    <AppShell
      bar={
        <AppBar
          title={title ?? slug}
          trail={[
            { label: 'Workspaces', href: '/' },
            { label: workspaceName, href: home },
          ]}
        />
      }
    >
      <div className={styles.page}>
        <PageHeader
          description={
            <>
              Each line names the place in <code>plans/{slug}/plan.yaml</code> to fix. The plan
              shows again once its errors are gone.
            </>
          }
          title={headline(problems.errors.length)}
        />
        <ProblemList {...problems} />
        <p>
          <Link href={home}>Back to {workspaceName}</Link>
        </p>
      </div>
    </AppShell>
  );
}
