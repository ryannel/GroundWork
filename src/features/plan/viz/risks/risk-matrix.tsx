import type { Model } from '@/application/plan/derive';
import { levelWord } from '@/application/plan-risk-words';
import {
  isResolved,
  numberOfRisk,
  riskFacts,
  riskGrid,
  risksOf,
  statementOf,
} from '@/application/plan-viz-risks';
import type { Risk } from '@/domain/plan/plan.generated';

import styles from './risk-matrix.module.css';

interface RiskMatrixProps {
  readonly model: Model;
  readonly ids: readonly string[];
  /** One risk id: its dot is filled and the others faint. */
  readonly focus?: string;
  /** "sm" is the small grid for a risk's own page. */
  readonly size?: 'md' | 'sm';
}

interface DotProps {
  readonly model: Model;
  readonly risk: Risk;
  readonly focus: string | undefined;
}

function focusOf(risk: Risk, focus: string | undefined): string | undefined {
  if (focus === undefined) return undefined;
  return risk.id === focus ? 'self' : 'faint';
}

function Dot({ model, risk, focus }: DotProps) {
  const number = numberOfRisk(model, risk);
  return (
    <button
      aria-label={`${number}: ${statementOf(risk)}`}
      className={styles.dot}
      data-facts={riskFacts(model, risk)}
      data-focus={focusOf(risk, focus)}
      data-inspect={risk.id}
      data-resolved={isResolved(risk) ? '' : undefined}
      type="button"
    >
      {number}
    </button>
  );
}

function plural(n: number): string {
  return `${String(n)} ${n === 1 ? 'risk' : 'risks'}`;
}

/**
 * Likelihood up, impact across, each risk a numbered dot in its cell. Two risks or more: one is a card, not a grid with
 * a single dot. A hollow dot is a resolved risk.
 */
export function RiskMatrix({ model, ids, focus, size = 'md' }: RiskMatrixProps) {
  const risks = risksOf(model, ids);
  if (risks.length < 2) return null;
  const grid = riskGrid(risks);
  const levels = grid[0]?.map((cell) => cell.impact) ?? [];
  return (
    <figure aria-label="Risks by likelihood and impact" className={styles.figure} data-size={size}>
      <div className={styles.plot}>
        <span className={styles.axisY}>likelihood</span>
        {grid.map((row) => (
          <div className={styles.row} key={row[0]?.likelihood}>
            <span className={styles.rowLabel}>{levelWord(row[0]?.likelihood ?? 'low')}</span>
            {row.map((cell) => (
              <div
                aria-label={`${levelWord(cell.likelihood)} likelihood, ${levelWord(cell.impact)} impact: ${plural(cell.risks.length)}`}
                className={styles.cell}
                data-impact={cell.impact}
                data-likelihood={cell.likelihood}
                data-shade={cell.shade}
                key={cell.impact}
                role="group"
              >
                {cell.risks.map((risk) => (
                  <Dot focus={focus} key={risk.id} model={model} risk={risk} />
                ))}
              </div>
            ))}
          </div>
        ))}
        <div className={styles.row}>
          <span />
          {levels.map((level) => (
            <span className={styles.colLabel} key={level}>
              {levelWord(level)}
            </span>
          ))}
        </div>
        <span className={styles.axisX}>impact →</span>
      </div>
      {size !== 'sm' && risks.some(isResolved) ? (
        <figcaption className={styles.note}>A hollow dot is a resolved risk.</figcaption>
      ) : null}
    </figure>
  );
}
