import type { Model } from '@/application/plan/derive';
import { searchText } from '@/application/plan-story-ref';
import { KIND_WORD, type LedgerRow as Row, proofLine } from '@/application/plan-viz-ledger-row';
import { teamName } from '@/application/plan-viz-teams';
import { EntityChip, EntityChips } from '@/features/plan/common/entity-chip';
import { ModelInline } from '@/features/plan/common/model-text';
import { TeamDot, TeamTag } from '@/features/plan/common/team-dot';
import { Badge, type BadgeTone } from '@/ui/badge';
import { ChipList } from '@/ui/chip';

import styles from './ledger-row.module.css';

const TONE = {
  add: 'added',
  modify: 'modified',
  deprecate: 'deprecated',
  remove: 'removed',
} as const satisfies Record<keyof typeof KIND_WORD, BadgeTone>;
const SIGN = { add: '+', modify: '~', deprecate: '−', remove: '×' } as const;

function Section({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className={styles.section}>
      <span className={styles.label}>{label}</span>
      <div className={styles.content}>{children}</div>
    </div>
  );
}

function Quiet({ children }: { readonly children: string }) {
  return <span className={styles.quiet}>{children}</span>;
}

function Body({ model, row }: { readonly model: Model; readonly row: Row }) {
  return (
    <div className={styles.body}>
      {row.ops.length > 0 ? (
        <Section label="What it does">
          {row.ops.map((o) => (
            <div className={styles.op} data-kind={o.kind} key={o.key}>
              <span aria-hidden="true">{SIGN[o.kind]}</span>
              <ModelInline model={model} text={o.text} />
            </div>
          ))}
        </Section>
      ) : null}
      {row.why === null ? null : (
        <Section label="Why">
          <ModelInline model={model} text={row.why} />
        </Section>
      )}
      {row.decisions.length > 0 ? (
        <Section label="Decision">
          <EntityChips ids={row.decisions} model={model} />
        </Section>
      ) : null}
      {row.rollout === null ? null : (
        <Section label="Rollout">
          <ModelInline model={model} text={row.rollout} />
        </Section>
      )}
      <Section label="Proved by">
        {row.tests.length > 0 ? (
          <EntityChips ids={row.tests} model={model} />
        ) : (
          <Quiet>No test proves this change yet.</Quiet>
        )}
      </Section>
      <Section label="Built by">
        {row.items.length > 0 ? (
          <EntityChips ids={row.items} model={model} />
        ) : (
          <Quiet>No work item builds this change yet.</Quiet>
        )}
      </Section>
      {row.teams.length > 1 ? (
        <Section label="Teams">
          {row.teams.map((t) => (
            <TeamTag key={t} model={model} teamId={t} />
          ))}
        </Section>
      ) : null}
      <div className={styles.foot}>
        <button className={styles.open} data-inspect={row.id} type="button">
          Open the change
        </button>
      </div>
    </div>
  );
}

/** One change: its title, what it touches and how it is proved and built, with the detail a click away. */
export function LedgerRow({
  model,
  row,
  open = false,
}: {
  readonly model: Model;
  readonly row: Row;
  readonly open?: boolean;
}) {
  return (
    <details
      className={styles.row}
      data-change={row.id}
      data-search={searchText(
        row.title,
        row.id,
        row.targets.map((t) => model.label(t)),
        row.teams.map((t) => teamName(model, t)),
      )}
      open={open}
    >
      <summary className={styles.summary}>
        <span className={styles.num}>{row.number}</span>
        <span className={styles.main}>
          <span className={styles.title}>
            <ModelInline model={model} text={row.title} />
          </span>
          <ChipList>
            {row.targets.map((id) => (
              <EntityChip id={id} key={id} model={model} />
            ))}
            {row.moreTargets > 0 ? (
              <span className={styles.quiet}>+{row.moreTargets} more</span>
            ) : null}
          </ChipList>
        </span>
        <span className={styles.teams}>
          {row.teams.map((t) => (
            <TeamDot key={t} model={model} teamId={t} />
          ))}
        </span>
        <span className={styles.kinds}>
          {row.kinds.map((k) => (
            <Badge key={k.kind} tone={TONE[k.kind]}>
              {k.n} {KIND_WORD[k.kind]}
            </Badge>
          ))}
        </span>
        <span className={styles.proof} data-gap={row.tests.length === 0 ? '' : undefined}>
          {proofLine(row.tests.length, row.items.length)}
        </span>
      </summary>
      <Body model={model} row={row} />
    </details>
  );
}
