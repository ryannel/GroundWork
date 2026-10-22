import type { Model } from '@/application/plan/derive';
import {
  type BlockStep,
  handlerStoryOf,
  type HandlerView,
  type LinkStep,
  type StepCode,
  type StepView,
} from '@/application/today-handler';
import { ModelText } from '@/features/plan/common/model-text';
import { Badge } from '@/ui/badge';
import { Cluster } from '@/ui/stack';
import { Text } from '@/ui/text';

import styles from './handler-story.module.css';
import { RefChip, RefChips } from './ref-chips';
import { Section } from './today-section';

function Code({ code }: { readonly code: StepCode | null }) {
  if (code === null) return null;
  return (
    <a className={styles.code} href={code.url} rel="noopener noreferrer" target="_blank">
      {code.label} ↗
    </a>
  );
}

function Guards({ step }: { readonly step: StepView }) {
  if (step.when === null && !step.async && step.code === null) return null;
  return (
    <span className={styles.guards}>
      {step.when === null ? null : <Text tone="muted">Only when {step.when}</Text>}
      {step.async ? <Badge>does not wait</Badge> : null}
      <Code code={step.code} />
    </span>
  );
}

function Deeper({ step, model }: { readonly step: LinkStep; readonly model: Model }) {
  if (step.stop === 'cycle') return <Text tone="faint">Already shown above.</Text>;
  if (step.stop === 'depth') {
    return <Text tone="faint">Open {step.chip.label} to follow it further.</Text>;
  }
  return (
    <>
      {step.next.map((next) => (
        <details className={styles.deeper} key={next.id}>
          <summary className={styles.more}>
            What {next.component.label} does with it · {String(next.steps.length)}{' '}
            {next.steps.length === 1 ? 'step' : 'steps'}
          </summary>
          <Body handler={next} model={model} />
        </details>
      ))}
    </>
  );
}

function Link({ step, model }: { readonly step: LinkStep; readonly model: Model }) {
  return (
    <>
      <span className={styles.line}>
        <Text weight="strong">{step.verb}</Text>
        <RefChip chip={step.chip} />
        {step.store === null ? null : (
          <>
            <Text tone="muted">{step.verb === 'Reads' ? 'from' : 'to'}</Text>
            <RefChip chip={step.store} />
          </>
        )}
      </span>
      {step.text === null ? null : <Text tone="muted">{step.text}</Text>}
      <Deeper model={model} step={step} />
    </>
  );
}

function Block({ step, model }: { readonly step: BlockStep; readonly model: Model }) {
  return (
    <>
      {step.text === null ? null : <Text weight="strong">{step.text}</Text>}
      <Guards step={step} />
      {step.branches.map((branch) => (
        <div className={styles.branch} key={branch.label}>
          <Text tone="accent" weight="strong">
            {branch.label}
          </Text>
          <Steps model={model} steps={branch.steps} />
        </div>
      ))}
    </>
  );
}

function Step({ step, model }: { readonly step: StepView; readonly model: Model }) {
  return (
    <li className={styles.step} data-kind={step.kind}>
      <div className={styles.what}>
        {step.kind === 'link' ? <Link model={model} step={step} /> : null}
        {step.kind === 'block' ? <Block model={model} step={step} /> : null}
        {step.kind === 'does' ? <Text>{step.text}</Text> : null}
        {step.kind === 'end' ? (
          <span className={styles.line}>
            <Text weight="strong">{step.text}</Text>
            {step.chip === null ? null : <RefChip chip={step.chip} />}
          </span>
        ) : null}
        {step.kind === 'block' ? null : <Guards step={step} />}
      </div>
    </li>
  );
}

function Steps({ steps, model }: { readonly steps: readonly StepView[]; readonly model: Model }) {
  return (
    <ol className={styles.steps}>
      {steps.map((step) => (
        <Step key={step.key} model={model} step={step} />
      ))}
    </ol>
  );
}

function Body({ handler, model }: { readonly handler: HandlerView; readonly model: Model }) {
  return (
    <div className={styles.body}>
      {handler.summary === null ? null : (
        <div className={styles.summary}>
          <ModelText model={model} text={handler.summary} />
        </div>
      )}
      <Steps model={model} steps={handler.steps} />
      {handler.fails.length === 0 ? null : (
        <div className={styles.fails}>
          <Text tone="muted" weight="strong">
            When it fails
          </Text>
          <ul className={styles.failList}>
            {handler.fails.map((fail) => (
              <li key={`${fail.result}:${fail.when}`}>
                <Badge tone="removed">{fail.result}</Badge> <Text tone="muted">{fail.when}</Text>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const TITLES: Partial<Record<string, string>> = {
  api: 'What happens when it is called',
  msg: 'What happens when it arrives',
};

interface HandlerStoryProps {
  readonly model: Model;
  readonly id: string;
}

/** What runs when a thing is called or arrives: each handler's steps in order, the forks and loops around them,
 * and under every call what the callee does in turn, opened on demand. Nothing when no handler is known. */
export function HandlerStory({ model, id }: HandlerStoryProps) {
  const story = handlerStoryOf(model, id);
  if (story === null) return null;
  return (
    <Section title={TITLES[id.split(':')[0] ?? ''] ?? 'What runs'}>
      {story.systems.length + story.stores.length === 0 ? null : (
        <dl className={styles.reach}>
          {story.systems.length === 0 ? null : (
            <>
              <dt>Systems it reaches</dt>
              <dd>
                <RefChips chips={story.systems} />
              </dd>
            </>
          )}
          {story.stores.length === 0 ? null : (
            <>
              <dt>Stores it touches</dt>
              <dd>
                <RefChips chips={story.stores} />
              </dd>
            </>
          )}
        </dl>
      )}
      {story.handlers.map((handler) => (
        <section className={styles.handler} key={handler.id}>
          <Cluster gap={2}>
            <Text tone="muted">Runs in</Text>
            <RefChip chip={handler.component} />
            <Code code={handler.code} />
          </Cluster>
          <Body handler={handler} model={model} />
        </section>
      ))}
      {story.outside.length === 0 ? null : (
        <div className={styles.unread}>
          <Text tone="faint">Hands over to parties outside the map</Text>
          <RefChips chips={story.outside} />
        </div>
      )}
      {story.unread.length === 0 ? null : (
        <div className={styles.unread}>
          <Text tone="faint">Not yet read from the code, so the trail stops at</Text>
          <RefChips chips={story.unread} />
        </div>
      )}
    </Section>
  );
}
