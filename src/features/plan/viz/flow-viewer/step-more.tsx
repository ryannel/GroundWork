import type { Model } from '@/application/plan/derive';
import { type Narration, caseWords } from '@/application/plan-viz-flow-narration';
import { ModelText } from '@/features/plan/common/model-text';
import { TintedDocument } from '@/features/plan/viz/waterfall/tinted-document';
import { Waterfall } from '@/features/plan/viz/waterfall/waterfall';

import styles from './step-more.module.css';

interface MoreProps {
  readonly model: Model;
  readonly narration: Narration;
  readonly mode: 'asIs' | 'toBe';
}

function Calls({ model, narration, mode }: MoreProps) {
  return narration.calls.map((c) => (
    <div className={styles.call} key={c.stepId}>
      <details className={styles.fold} data-keep="the-query">
        <summary>
          The query · what the client sends, each field coloured by the team that answers it
        </summary>
        <TintedDocument id={c.via} mode={mode} model={model} />
      </details>
      <details className={styles.fold} data-keep="behind-call">
        <summary>Behind this call · {caseWords(c.kase)}</summary>
        <Waterfall compact id={c.via} kase={c.kase} mode={mode} model={model} stepId={c.stepId} />
      </details>
    </div>
  ));
}

function Fails({ model, narration }: Pick<MoreProps, 'model' | 'narration'>) {
  const { fails } = narration;
  const [only] = fails;
  if (only === undefined) return null;
  if (fails.length === 1) {
    return (
      <div className={styles.fails}>
        <strong>If it fails</strong>
        <ModelText model={model} text={only.text} />
      </div>
    );
  }
  return (
    <details className={styles.fold} data-keep="failure">
      <summary>If it fails · {fails.length} steps</summary>
      <ul className={styles.list}>
        {fails.map((f) => (
          <li key={f.action}>
            <strong>{f.action}</strong>
            <ModelText model={model} text={f.text} />
          </li>
        ))}
      </ul>
    </details>
  );
}

function nounOf(via: string | null): string {
  if (via?.startsWith('msg:') === true) return 'event';
  return via?.startsWith('gql:') === true ? 'query' : 'API';
}

function Actions({ narration }: Pick<MoreProps, 'narration'>) {
  const [via] = narration.vias;
  const open = narration.vias.length === 1 && via !== undefined ? via : null;
  const noun = nounOf(open);
  return (
    <div className={styles.actions}>
      {open === null ? null : (
        <button className={styles.action} data-inspect={open} type="button">
          Open the {noun}
        </button>
      )}
      {narration.openScreen === null ? null : (
        <button className={styles.action} data-inspect={narration.openScreen} type="button">
          Open the screen
        </button>
      )}
      {narration.group ? null : (
        <button className={styles.action} data-inspect={narration.first.id} type="button">
          Step details
        </button>
      )}
    </div>
  );
}

// What lies behind a stop: the query it runs, how it fails, and the places to open it.
export function StepMore({ model, narration, mode }: MoreProps) {
  return (
    <>
      <Calls mode={mode} model={model} narration={narration} />
      <Fails model={model} narration={narration} />
      <Actions narration={narration} />
    </>
  );
}
