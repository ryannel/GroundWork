import type { Model } from '@/application/plan/derive';
import {
  contractFindings,
  type ContractCell,
  type ContractFindings,
  type ContractRow,
} from '@/application/plan-viz-contract-matrix';
import { EntityChip } from '@/features/plan/common/entity-chip';
import { NamedChip } from '@/features/plan/common/named-chip';
import { ServiceChip } from '@/features/plan/common/service-chip';
import { NoneMark } from '@/features/plan/common/test-button';
import { ChipList } from '@/ui/chip';

import styles from './contract-matrix.module.css';

interface ContractMatrixProps {
  readonly model: Model;
  /** A team id: services outside it are dimmed. */
  readonly lens?: string;
}

/** The tests of one pair, each with the calls and events it checks. */
function Tests({ model, cell }: { readonly model: Model; readonly cell: ContractCell }) {
  return cell.tests.map((t) => (
    <div className={styles.test} key={t.test}>
      <NamedChip id={t.test} model={model} />
      <div className={styles.via}>
        <span className={styles.faint}>checks</span>
        <ChipList>
          {t.vias.map((v) => (
            <EntityChip id={v} key={v} model={model} status="existing" />
          ))}
        </ChipList>
      </div>
    </div>
  ));
}

function Grid({
  model,
  providers,
  rows,
}: {
  readonly model: Model;
  readonly providers: readonly string[];
  readonly rows: readonly ContractRow[];
}) {
  return (
    <div className={styles.wrap}>
      <table className={styles.matrix}>
        <thead>
          <tr>
            <th className={styles.corner} scope="col">
              consumer ↓ · provider →
            </th>
            {providers.map((p) => (
              <th key={p} scope="col">
                <span className={styles.axis}>provider</span>
                <ServiceChip id={p} model={model} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr data-dim={r.dim ? '' : undefined} key={r.consumer}>
              <th scope="row">
                <span className={styles.axis}>consumer</span>
                <ServiceChip id={r.consumer} model={model} />
              </th>
              {r.cells.map((c) => (
                <td
                  className={styles.cell}
                  data-gap={c.tests.length === 0 ? '' : undefined}
                  key={c.provider}
                >
                  {c.tests.length === 0 ? (
                    <NoneMark title="No contract test between these two" />
                  ) : (
                    <Tests cell={c} model={model} />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** With many providers a grid is mostly empty cells: one block per consumer, listing only the providers it reads from. */
function List({ model, rows }: { readonly model: Model; readonly rows: readonly ContractRow[] }) {
  return (
    <div className={styles.list}>
      {rows.map((r) => (
        <section data-dim={r.dim ? '' : undefined} key={r.consumer}>
          <h4 className={styles.consumer}>
            <span className={styles.axis}>consumer</span>
            <ServiceChip id={r.consumer} model={model} />
          </h4>
          {r.cells
            .filter((c) => c.tests.length > 0)
            .map((c) => (
              <div className={styles.provider} key={c.provider}>
                <span className={styles.axis}>reads from</span>
                <ServiceChip id={c.provider} model={model} />
                <Tests cell={c} model={model} />
              </div>
            ))}
        </section>
      ))}
    </div>
  );
}

const MANY_PROVIDERS = 5;

function Body({ model, f }: { readonly model: Model; readonly f: ContractFindings }) {
  if (f.rows.length === 0)
    return <p className={styles.empty}>No contract-level tests in this plan.</p>;
  if (f.providers.length > MANY_PROVIDERS) return <List model={model} rows={f.rows} />;
  return <Grid model={model} providers={f.providers} rows={f.rows} />;
}

/** Consumers down, providers across: the contract test between each pair, with the calls and events it checks. */
export function ContractMatrix({ model, lens }: ContractMatrixProps) {
  const f = contractFindings(model, lens);
  return (
    <div>
      <Body f={f} model={model} />
      {f.orphans.length === 0 ? null : (
        <p className={styles.note}>
          Contract tests that check no call between services:{' '}
          {f.orphans.map((t) => (
            <NamedChip id={t} key={t} model={model} />
          ))}
        </p>
      )}
    </div>
  );
}
