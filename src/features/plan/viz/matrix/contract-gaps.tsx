import type { Model } from '@/application/plan/derive';
import { contractFindings } from '@/application/plan-viz-contract-matrix';
import { countOf } from '@/application/plan-viz-text';
import { EntityChip } from '@/features/plan/common/entity-chip';
import { ServiceChip } from '@/features/plan/common/service-chip';

import styles from './contract-gaps.module.css';

interface ContractGapsProps {
  readonly model: Model;
  readonly lens?: string;
}

/**
 * The calls and events this plan adds or re-routes that no contract test checks. With none, only the line about links the
 * plan leaves alone; nothing when there are none of those either.
 */
export function ContractGaps({ model, lens }: ContractGapsProps) {
  const { missing, untouched } = contractFindings(model, lens);
  const rest =
    untouched === 0 ? null : (
      <p className={styles.note}>
        {countOf(untouched, 'other link')} between services {untouched === 1 ? 'has' : 'have'} no
        contract test either, but this plan doesn’t change {untouched === 1 ? 'it' : 'them'}.
      </p>
    );
  if (missing.length === 0) return rest;
  return (
    <section className={styles.gaps}>
      <h3 className={styles.title}>
        {countOf(missing.length, 'changed link')} {missing.length === 1 ? 'has' : 'have'} no
        contract test
      </h3>
      <p className={styles.note}>
        Changed or new calls and events that no contract test checks. The next page shows whether
        another kind of test does.
      </p>
      <div className={styles.wrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">consumer</th>
              <th aria-hidden="true" />
              <th scope="col">provider</th>
              <th scope="col">via</th>
              <th scope="col">
                <span className={styles.sr}>note</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {missing.map((p) => (
              <tr data-dim={p.dim ? '' : undefined} key={`${p.consumer}|${p.provider}|${p.via}`}>
                <td>
                  <ServiceChip id={p.consumer} model={model} />
                </td>
                <td aria-hidden="true">→</td>
                <td>
                  <ServiceChip id={p.provider} model={model} />
                </td>
                <td>
                  <EntityChip
                    id={p.via}
                    model={model}
                    {...(p.changed ? {} : { status: 'existing' as const })}
                  />
                </td>
                <td className={styles.note}>
                  {p.checkedElsewhere ? 'this pair is checked through another call' : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rest}
    </section>
  );
}
