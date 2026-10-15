import type { Model } from '@/application/plan/derive';
import { teamOf } from '@/application/plan-viz-teams';
import { levelStats, LEVEL_MEANS, levelWord, PLANNED } from '@/application/plan-viz-tests';
import { Glyph } from '@/ui/icon';

import styles from './coverage-matrix.module.css';
import { CoverageRow, type CoverageDetail } from './coverage-row';

interface CoverageMatrixProps {
  readonly model: Model;
  /** A team id: only that team's changes are listed. */
  readonly lens?: string;
  /** What a count opens, in place of the plain list of tests: say, the flow the tests walk. */
  readonly detail?: CoverageDetail;
}

/**
 * Changes down, test levels across, then where the tests run. A covered cell is the planned glyph and a count, a button
 * that opens the tests; an empty cell is a faint dot, loud where it is the gap a flag names. A totals row matches the
 * pyramid. The change and the counts are the only controls.
 */
export function CoverageMatrix({ model, lens, detail }: CoverageMatrixProps) {
  const st = levelStats(model, lens);
  if (st.m === 0) {
    return (
      <p className={styles.empty}>
        No changes{lens === undefined ? '' : ' for this team'} in this plan.
      </p>
    );
  }
  const teams = new Set(st.rows.map((r) => teamOf(model, r.change)));
  const oneTeam = teams.size <= 1;
  return (
    <div>
      <div className={styles.wrap}>
        <table className={styles.matrix}>
          <thead>
            <tr>
              <th className={styles.change} scope="col">
                change
              </th>
              {st.levels.map((l) => (
                <th key={l} scope="col" title={LEVEL_MEANS[l]}>
                  {levelWord(l)}
                </th>
              ))}
              <th scope="col" title="Where the tests run">
                where it runs
              </th>
            </tr>
          </thead>
          <tbody>
            {st.rows.map((r) => (
              <CoverageRow
                detail={detail}
                key={r.change}
                levels={st.levels}
                model={model}
                row={r}
                team={oneTeam ? undefined : (teamOf(model, r.change) ?? undefined)}
              />
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Changes with a test</th>
              {st.levels.map((l) => (
                <td key={l}>
                  {st.by[l]?.changes ?? 0} of {st.m}
                </td>
              ))}
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <p className={styles.key}>
        <span aria-hidden="true">
          <Glyph glyph={PLANNED} />
        </span>{' '}
        a planned test: nothing has run yet. Open a count to see the tests.
      </p>
    </div>
  );
}
