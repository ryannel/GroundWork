import type { Model } from '@/application/plan/derive';
import type {
  FlowView,
  JourneyRow,
  JourneyView,
  StepPart,
  StepView,
} from '@/application/plan-story-versions-journey';
import { ModelInline } from '@/features/plan/common/model-text';

import { DiffPair } from './diff-pair';
import styles from './journey-block.module.css';
import { MarkTag, ScreenChange } from './screen-change';
import { WorkRows } from './work-rows';

interface Ctx {
  readonly model: Model;
  readonly base: string;
}

function Part({ ctx, part }: { readonly ctx: Ctx; readonly part: StepPart }) {
  switch (part.kind) {
    case 'alarm': {
      return (
        <p className={styles.alarm}>
          <ModelInline model={ctx.model} text={part.text} />
        </p>
      );
    }
    case 'carry': {
      return (
        <p className={styles.part}>
          <ModelInline model={ctx.model} text={part.text} />
        </p>
      );
    }
    case 'key': {
      return (
        <div className={styles.part}>
          <span className={styles.label}>{part.label}</span>
          {part.diff === null ? (
            <span data-struck={part.struck ? '' : undefined}>{part.text}</span>
          ) : (
            <DiffPair diff={part.diff} />
          )}
        </div>
      );
    }
    case 'screen': {
      return <ScreenChange base={ctx.base} model={ctx.model} screen={part.screen} />;
    }
  }
}

function StepLine({ step }: { readonly step: StepView }) {
  return (
    <span className={styles.line}>
      <span className={styles.n}>{step.n}</span>
      <span className={styles.action}>{step.action}</span>
      <code className={styles.route}>{step.route}</code>
      {step.mark === null ? null : <MarkTag mark={step.mark} />}
      {step.newCall ? <span className={styles.call}>new call</span> : null}
      {step.reopened === null ? null : <span className={styles.call}>{step.reopened}</span>}
    </span>
  );
}

function Step({ ctx, step }: { readonly ctx: Ctx; readonly step: StepView }) {
  if (step.mark === null) {
    return (
      <li className={styles.plain}>
        <StepLine step={step} />
      </li>
    );
  }
  return (
    <li className={styles.step}>
      <details open={step.open}>
        <summary>
          <StepLine step={step} />
        </summary>
        <div className={styles.parts}>
          {step.parts.map((part, i) => (
            <Part ctx={ctx} key={`${part.kind}${String(i)}`} part={part} />
          ))}
          {step.builtBy.length === 0 ? null : (
            <div className={styles.built}>
              <span className={styles.label}>Built by</span>
              <WorkRows model={ctx.model} rows={step.builtBy} />
            </div>
          )}
        </div>
      </details>
    </li>
  );
}

function Row({ ctx, row }: { readonly ctx: Ctx; readonly row: JourneyRow }) {
  if (row.kind === 'step') return <Step ctx={ctx} step={row.step} />;
  return (
    <li className={styles.fold} title={row.title ?? undefined}>
      {row.text}
    </li>
  );
}

function Flow({ ctx, flow }: { readonly ctx: Ctx; readonly flow: FlowView }) {
  return (
    <section className={styles.flow}>
      <div className={styles.head}>
        <h4 className={styles.name}>{flow.name}</h4>
        {flow.badge === null ? null : <MarkTag mark={flow.badge} />}
        {flow.actor === null ? null : <span className={styles.actor}>{flow.actor}</span>}
      </div>
      <ol className={styles.steps}>
        {flow.rows.map((row, i) => (
          <Row ctx={ctx} key={`${row.kind}${String(i)}`} row={row} />
        ))}
      </ol>
    </section>
  );
}

/** The flows a revision changes, step by step, and any screens it changes outside a flow. */
export function JourneyBlock({
  model,
  base,
  view,
}: {
  readonly model: Model;
  readonly base: string;
  readonly view: JourneyView;
}) {
  const ctx = { model, base };
  if (view.flows.length === 0 && view.loose.length === 0) {
    return <p className={styles.quiet}>No step or screen changes.</p>;
  }
  return (
    <div className={styles.block}>
      {view.flows.map((flow) => (
        <Flow ctx={ctx} flow={flow} key={flow.id} />
      ))}
      {view.loose.map((screen) => (
        <ScreenChange base={base} key={screen.id} model={model} screen={screen} />
      ))}
    </div>
  );
}
