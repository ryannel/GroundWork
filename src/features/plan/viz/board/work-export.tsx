import type { Model } from '@/application/plan/derive';
import { issueMarkdown } from '@/application/plan/issues';
import { teamName } from '@/application/plan-viz-teams';
import { countOf } from '@/application/plan-viz-text';
import { milestoneById, orderTeams, workOrdered } from '@/application/plan-viz-work';
import type { WorkItem } from '@/domain/plan/plan.generated';
import { TeamDot } from '@/features/plan/common/team-dot';

import { CopyButton } from './copy-button.client';
import styles from './work-export.module.css';
import { IssueLink } from './work-item-parts';

interface WorkExportProps {
  readonly model: Model;
  /** A team id: its work comes first and the others dim. */
  readonly lens?: string | undefined;
}

const asText = (w: WorkItem, body: string): string => `# ${w.title}\n\n${body}`;

function Item({
  model,
  w,
  position,
}: {
  readonly model: Model;
  readonly w: WorkItem;
  readonly position: number;
}) {
  const body = issueMarkdown(model, w.id);
  const ms = milestoneById(model, w.milestone);
  return (
    <details className={styles.item}>
      <summary className={styles.summary}>
        <span className={styles.order} title="Position in build order">
          {position}
        </span>
        <span className={styles.main}>
          <span className={styles.title}>{w.title}</span>
          <span className={styles.meta}>
            <span>size {w.size ?? '?'}</span>
            {ms === undefined ? null : <span>{ms.name}</span>}
            {w.repo === undefined ? null : (
              <span title={`Filed in ${w.repo}`}>{w.repo.split('/').pop()}</span>
            )}
          </span>
        </span>
        <IssueLink model={model} w={w} />
        <CopyButton text={asText(w, body)}>Copy as text</CopyButton>
      </summary>
      <div className={styles.preview}>
        <div className={styles.head}>
          <span className={styles.title}>{w.title}</span>
          {w.repo === undefined ? null : <span className={styles.repo}>{w.repo}</span>}
        </div>
        <pre className={styles.body}>{body}</pre>
        <button className={styles.show} data-inspect={w.id} type="button">
          Show
        </button>
      </div>
    </details>
  );
}

/**
 * The work as GitHub issues: grouped by team, each item a collapsed issue preview with "Copy as text", and "Copy as
 * text" for a whole team. It is the body of the "Send to GitHub" fold; no page leads with it.
 */
export function WorkExport({ model, lens }: WorkExportProps) {
  const work = workOrdered(model);
  if (work.length === 0) return <p className={styles.empty}>No work items in this plan.</p>;
  const present = orderTeams(
    model,
    work.map((w) => w.team),
  );
  const teams =
    lens !== undefined && present.includes(lens)
      ? [lens, ...present.filter((t) => t !== lens)]
      : present;
  const position = new Map(work.map((w, i) => [w.id, i + 1]));
  return (
    <>
      {teams.map((team) => {
        const mine = work.filter((w) => w.team === team);
        const all = mine.map((w) => asText(w, issueMarkdown(model, w.id))).join('\n\n---\n\n');
        return (
          <section
            className={styles.team}
            data-dim={lens !== undefined && lens !== team ? '' : undefined}
            key={team}
          >
            <header className={styles.teamHead}>
              <TeamDot model={model} teamId={team} />
              <button className={styles.teamName} data-inspect={team} type="button">
                {teamName(model, team)}
              </button>
              <span className={styles.count}>{countOf(mine.length, 'work item')}</span>
              <CopyButton
                text={all}
                title={`Copy every ${teamName(model, team)} work item as one text`}
              >
                {mine.length > 1 ? `Copy as text (all ${String(mine.length)})` : 'Copy as text'}
              </CopyButton>
            </header>
            <div className={styles.list}>
              {mine.map((w) => (
                <Item key={w.id} model={model} position={position.get(w.id) ?? 0} w={w} />
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}
