import type { Model } from '@/application/plan/derive';
import { teamIndex, teamName } from '@/application/plan-viz-teams';
import { VOTE_MAX, voteSummary, voteTileList, type VoteTile } from '@/application/plan-viz-vote';
import { ModelText } from '@/features/plan/common/model-text';
import { TeamDot } from '@/features/plan/common/team-dot';
import { Badge } from '@/ui/badge';

import styles from './vote-tiles.module.css';

interface VoteTilesProps {
  readonly model: Model;
  /** The teams to show; every team that rates, by default. */
  readonly teams?: readonly string[];
  /** Teams whose rating was made before a proposal. */
  readonly stale?: readonly string[];
  /** What they rated before, for the badge. */
  readonly before?: string;
}

function Pips({ score }: { readonly score: number | null }) {
  const filled = score ?? 0;
  return (
    <span aria-hidden="true" className={styles.pips}>
      {Array.from({ length: VOTE_MAX }, (_, i) => i + 1).map((i) => (
        <span className={styles.pip} data-on={i <= filled ? '' : undefined} key={i} />
      ))}
    </span>
  );
}

function Tile({
  model,
  tile,
  stale,
  before,
}: {
  readonly model: Model;
  readonly tile: VoteTile;
  readonly stale: boolean;
  readonly before: string;
}) {
  const { team, score, note } = tile;
  return (
    <article
      className={styles.tile}
      data-low={tile.low ? '' : undefined}
      data-missing={score === null ? '' : undefined}
      data-team-slot={teamIndex(model, team)}
    >
      <div className={styles.who}>
        <TeamDot model={model} named teamId={team} />
        <button className={styles.team} data-inspect={team} type="button">
          {teamName(model, team)}
        </button>
      </div>
      <div className={styles.score}>
        {score === null ? (
          <span className={styles.notYet}>not yet</span>
        ) : (
          <>
            <span className={styles.value}>{score}</span>{' '}
            <span className={styles.of}>of {VOTE_MAX}</span>
          </>
        )}
      </div>
      <Pips score={score} />
      {stale ? <Badge>rated before {before}</Badge> : null}
      {note === null ? null : <ModelText model={model} text={note} />}
      {note === null && score === null ? <p className={styles.faint}>Not rated yet.</p> : null}
    </article>
  );
}

/** One tile per team that rates: the score, five pips, a note, and a mark on a rating made before a proposal. */
export function VoteTiles({ model, teams, stale = [], before = '' }: VoteTilesProps) {
  const list = voteTileList(model, teams ?? voteSummary(model).teams);
  return (
    <div className={styles.tiles}>
      {list.map((t) => (
        <Tile before={before} key={t.team} model={model} stale={stale.includes(t.team)} tile={t} />
      ))}
    </div>
  );
}
