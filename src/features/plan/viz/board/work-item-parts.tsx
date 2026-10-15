import type { Model } from '@/application/plan/derive';
import { msShort } from '@/application/plan-viz-ladder-order';
import {
  issueNumber,
  issueUrl,
  milestoneById,
  SIZE_WORD,
  STATE_GLYPH,
  STATE_WORD,
  type WorkState,
  wiState,
} from '@/application/plan-viz-work';
import type { WorkItem } from '@/domain/plan/plan.generated';

import styles from './work-item-parts.module.css';

/** "✓ done", "◐ open", "○ not started": only once delivery has begun. */
function StateTag({ state }: { readonly state: WorkState | null }) {
  if (state === null) return null;
  return (
    <span
      className={styles.state}
      data-state={state}
      title={`This work item is ${STATE_WORD[state]}`}
    >
      <span aria-hidden="true">{STATE_GLYPH[state]}</span> {STATE_WORD[state]}
    </span>
  );
}

/** The GitHub issue as a small "#41" link, or a plain tag when there is nowhere to link to. */
export function IssueLink({ model, w }: { readonly model: Model; readonly w: WorkItem }) {
  if (w.github_issue === undefined) return null;
  const url = issueUrl(model, w);
  const number = issueNumber(w);
  if (url === null) return <span className={styles.issue}>{number}</span>;
  return (
    <a
      className={styles.issue}
      href={url}
      rel="noopener noreferrer"
      target="_blank"
      title={`GitHub issue ${w.repo ?? ''}${number}`}
    >
      {number}
    </a>
  );
}

/** Line one of a work item: state and issue, size, milestone, critical path. */
export function FactsLine({
  model,
  w,
  critical,
  issue = true,
}: {
  readonly model: Model;
  readonly w: WorkItem;
  readonly critical: boolean;
  readonly issue?: boolean;
}) {
  const state = wiState(model, w.id);
  const ms = milestoneById(model, w.milestone);
  return (
    <div className={styles.facts}>
      <StateTag state={state} />
      {state !== null && issue ? <IssueLink model={model} w={w} /> : null}
      {w.size === undefined ? null : (
        <span className={styles.size} title={`Size ${SIZE_WORD[w.size] ?? w.size}`}>
          {w.size}
        </span>
      )}
      {ms === undefined ? null : (
        <button className={styles.ms} data-inspect={ms.id} title={ms.name} type="button">
          {msShort(model, ms.id)}
        </button>
      )}
      {critical ? (
        <span
          className={styles.critical}
          title="Part of the largest chain of dependent work, measured by work item size."
        >
          critical path
        </span>
      ) : null}
    </div>
  );
}
