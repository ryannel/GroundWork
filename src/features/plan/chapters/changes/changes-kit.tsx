import Link from 'next/link';
import type { ReactNode } from 'react';

import type { Model } from '@/application/plan/derive';
import { pageHref, type Outline } from '@/application/plan-pages';
import { flowShowing, journeyKeyOf } from '@/application/plan-story-changes-links';
import { firstSentence } from '@/application/plan-viz-text';
import { EntityChip } from '@/features/plan/common/entity-chip';
import { ModelInline } from '@/features/plan/common/model-text';
import { TeamTag } from '@/features/plan/common/team-dot';

import styles from './changes-kit.module.css';

const uniq = <T,>(xs: readonly T[]): T[] => [...new Set(xs)];
const SHOWN = 2;

interface DecisionsProps {
  readonly model: Model;
  readonly changeIds: readonly string[];
}

/** The decisions behind some changes, one line each. */
export function Decisions({ model, changeIds }: DecisionsProps) {
  const ids = uniq(
    changeIds.flatMap((c) => model.plan.changes?.find((x) => x.id === c)?.decisions ?? []),
  );
  if (ids.length === 0) return null;
  return (
    <div className={styles.decisions}>
      {ids.slice(0, SHOWN).map((id) => {
        const d = model.plan.decisions?.find((x) => x.id === id);
        return (
          <div className={styles.decision} key={id}>
            <span aria-hidden="true" className={styles.icon}>
              ⚖
            </span>
            <div className={styles.decisionBody}>
              <span className={styles.kicker}>
                Decision{d === undefined ? '' : ` · ${d.status}`}
              </span>
              <EntityChip id={id} model={model} />
              <span className={styles.sentence}>
                <ModelInline model={model} text={firstSentence(d?.decision ?? '')} />
              </span>
            </div>
          </div>
        );
      })}
      {ids.length > SHOWN ? (
        <span className={styles.more}>+{ids.length - SHOWN} more decisions</span>
      ) : null}
    </div>
  );
}

interface JourneyLinkProps {
  readonly model: Model;
  readonly outline: Outline;
  /** The flow to open; a screen opens the first flow that shows it. */
  readonly flowId?: string | null;
  readonly screenId?: string;
  readonly label: string;
}

/** A link into chapter 3, where the flow or screen is walked; nothing when the journey does not show it. */
export function JourneyLink({ model, outline, flowId = null, screenId, label }: JourneyLinkProps) {
  const flow = flowId ?? (screenId === undefined ? null : flowShowing(model, screenId));
  const key = flow === null ? null : journeyKeyOf(model, flow);
  if (key === null) return null;
  const hasPage = outline.pages.some((p) => p.chapter === 'journey' && p.screen === key);
  if (!hasPage) return null;
  return (
    <p className={styles.journey}>
      <Link className={styles.button} href={pageHref(outline, 'journey', key)}>
        Open journey · {label} →
      </Link>
    </p>
  );
}

interface BlockProps {
  readonly title: string;
  readonly children: ReactNode;
}

/** A labelled part of a screen. */
export function Block({ title, children }: BlockProps) {
  return (
    <section className={styles.block}>
      <h3 className={styles.label}>{title}</h3>
      {children}
    </section>
  );
}

/** The teams behind some changes, as tags. */
export function TeamRow({
  model,
  teamIds,
}: {
  readonly model: Model;
  readonly teamIds: readonly string[];
}) {
  if (teamIds.length === 0) return null;
  return (
    <div className={styles.teams}>
      {teamIds.map((t) => (
        <TeamTag key={t} model={model} teamId={t} />
      ))}
    </div>
  );
}
