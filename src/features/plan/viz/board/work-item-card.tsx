import type { Model } from '@/application/plan/derive';
import { searchText } from '@/application/plan-story-ref';
import { sequenceNotes, msShort } from '@/application/plan-viz-ladder-order';
import { teamName } from '@/application/plan-viz-teams';
import {
  criticalSet,
  dependentsOf,
  revisionTag,
  type RevisionTag,
  teamSlot,
  wiState,
  workById,
  workFacts,
} from '@/application/plan-viz-work';
import type { WorkItem } from '@/domain/plan/plan.generated';
import { ModelInline } from '@/features/plan/common/model-text';
import { TeamTag } from '@/features/plan/common/team-dot';
import { Glyph } from '@/ui/icon';

import { GateChip } from './gate-chip';
import { WorkChip } from './work-chip';
import styles from './work-item-card.module.css';
import { FactsLine } from './work-item-parts';

interface WorkItemCardProps {
  readonly model: Model;
  readonly w: WorkItem;
  /** A card (waves) or one grid line (every list): same fields, same order. */
  readonly density?: 'card' | 'row';
  /** What a proposal does to it: "reopened in 1.2". */
  readonly revision?: RevisionTag | undefined;
  /** A team id: other teams' items dim. */
  readonly lens?: string | undefined;
  /** False leaves the waits-on chips out, for a page that says them once. */
  readonly waits?: boolean;
  /** Overrides the model's critical path. */
  readonly critical?: boolean;
}

interface GroupProps {
  readonly label: string;
  readonly children: React.ReactNode;
}

function Group({ label, children }: GroupProps) {
  return (
    <span className={styles.group}>
      <span className={styles.key}>{label}</span>
      {children}
    </span>
  );
}

interface ChipsProps {
  readonly model: Model;
  readonly ids: readonly string[];
  readonly show: number;
}

/** The first few work items as chips, and "+n" for the rest, whose names are on hover. */
function Chips({ model, ids, show }: ChipsProps) {
  const rest = ids.slice(show);
  const names = rest.map((id) => workById(model, id)?.title ?? id).join('\n');
  return (
    <>
      {ids.slice(0, show).map((id) => (
        <WorkChip id={id} key={id} model={model} />
      ))}
      {rest.length === 0 ? null : (
        <span className={styles.more} title={names}>
          +{rest.length}
        </span>
      )}
    </>
  );
}

function Tag({ revision }: { readonly revision: RevisionTag }) {
  const tag = revisionTag(revision);
  return (
    <span className={styles.revision} data-pending={tag.pending ? '' : undefined} title={tag.why}>
      {tag.text}
    </span>
  );
}

function Notes({ notes }: { readonly notes: readonly string[] }) {
  return notes.map((note) => (
    <span className={styles.seq} key={note} role="note">
      <Glyph glyph="⚠" /> {note}
    </span>
  ));
}

/** Line three: its team, what it waits on, what it needs and what needs it. */
function Links({
  model,
  w,
  waits,
}: {
  readonly model: Model;
  readonly w: WorkItem;
  readonly waits: boolean;
}) {
  const gates = waits ? model.blockersOf(w.id) : [];
  const needs = (w.depends_on ?? []).filter((id) => workById(model, id) !== undefined);
  const blocks = dependentsOf(model, w.id).map((b) => b.id);
  return (
    <div className={styles.links}>
      <TeamTag model={model} teamId={w.team} />
      {gates.length === 0 ? null : (
        <Group label="waits on">
          {gates.map((id) => (
            <GateChip id={id} key={id} model={model} />
          ))}
        </Group>
      )}
      {needs.length === 0 ? null : (
        <Group label="needs">
          <Chips ids={needs} model={model} show={3} />
        </Group>
      )}
      {blocks.length === 0 ? null : (
        <Group label="blocks">
          <Chips ids={blocks} model={model} show={2} />
        </Group>
      )}
    </div>
  );
}

/** Line two: the title, what a proposal does to it, and any sequencing warnings. */
function TitleLine({
  model,
  w,
  revision,
}: {
  readonly model: Model;
  readonly w: WorkItem;
  readonly revision?: RevisionTag | undefined;
}) {
  return (
    <div className={styles.title}>
      <button data-inspect={w.id} type="button">
        <ModelInline model={model} text={w.title} />
      </button>
      {revision === undefined ? null : <Tag revision={revision} />}
      <Notes notes={sequenceNotes(model).get(w.id) ?? []} />
    </div>
  );
}

/**
 * A work item, the one way it is drawn. Line one: state and issue, size, milestone, critical path. Line two: the
 * title. Line three: its team, what it waits on, what it needs and what needs it.
 */
export function WorkItemCard({
  model,
  w,
  density = 'card',
  revision,
  lens,
  waits = true,
  critical,
}: WorkItemCardProps) {
  const isCritical = critical ?? criticalSet(model).has(w.id);
  return (
    <article
      className={styles.card}
      data-critical={isCritical ? '' : undefined}
      data-density={density}
      data-dim={lens !== undefined && lens !== w.team ? '' : undefined}
      data-done={wiState(model, w.id) === 'done' ? '' : undefined}
      data-facts={workFacts(model, w, (ms) => msShort(model, ms.id))}
      data-search={searchText(
        w.title,
        w.id,
        teamName(model, w.team),
        w.milestone === undefined ? '' : model.label(w.milestone),
      )}
      data-slot={teamSlot(model, w)}
    >
      <FactsLine critical={isCritical} model={model} w={w} />
      <TitleLine model={model} revision={revision} w={w} />
      <Links model={model} w={w} waits={waits} />
    </article>
  );
}
