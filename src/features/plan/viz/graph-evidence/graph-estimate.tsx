import type { Model } from '@/application/plan/derive';
import { prop } from '@/application/plan/ids';
import { registryEvidence } from '@/application/plan/registry-evidence';

import styles from './graph-estimate.module.css';

interface GraphEstimateProps {
  readonly model: Model;
  /** The operation, by id. */
  readonly id: string;
  /** Which side of the plan to read it from. */
  readonly mode?: 'asIs' | 'toBe';
}

// Qualifies a derived figure where it is read: until the registry confirms an operation's query plan, what the
// plan says about it is an estimate. Draws nothing when the registry already backs it, or the operation is unknown.
export function GraphEstimate({ model, id, mode = 'toBe' }: GraphEstimateProps) {
  const node = model[mode].byId.get(id);
  if (node === undefined) return null;
  const { evidence, question } = registryEvidence(model, id, {
    plan_check: prop(node, 'plan_check'),
  });
  if (evidence) return null;
  return (
    <span className={styles.estimate} data-facts="registry estimated" data-facts-of={id}>
      Derived estimate
      {question === null ? null : (
        <>
          {' · '}
          <button className={styles.link} data-inspect={question} type="button">
            registry check open
          </button>
        </>
      )}
    </span>
  );
}
