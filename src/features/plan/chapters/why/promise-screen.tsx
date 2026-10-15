import type { ReactNode } from 'react';

import { promiseView } from '@/application/plan-story-why';
import { ScreenHead } from '@/features/plan/chapters/screen-head';
import { ModelInline } from '@/features/plan/common/model-text';
import type { BodyProps } from '@/features/plan/screen-bodies';

import styles from './promise-screen.module.css';

interface ColumnProps {
  readonly kind: 'promise' | 'wont' | 'budget';
  readonly mark: string;
  readonly title: string;
  readonly children: ReactNode;
}

function Column({ kind, mark, title, children }: ColumnProps) {
  return (
    <section className={styles.column} data-kind={kind}>
      <header className={styles.columnHead}>
        <span aria-hidden="true" className={styles.mark}>
          {mark}
        </span>
        <h3 className={styles.columnTitle}>{title}</h3>
      </header>
      {children}
    </section>
  );
}

function Items({
  model,
  items,
  none,
}: Pick<BodyProps, 'model'> & { readonly items: readonly string[]; readonly none: string }) {
  if (items.length === 0) return <p className={styles.none}>{none}</p>;
  return (
    <ul className={styles.list}>
      {items.map((item) => (
        <li className={styles.item} key={item}>
          <ModelInline model={model} text={item} />
        </li>
      ))}
    </ul>
  );
}

// What the plan promises, what it rules out, and the time it will spend: the first promise is the headline.
export function PromiseScreen({ model, outline, page }: BodyProps) {
  const view = promiseView(model);
  return (
    <>
      <ScreenHead headline={view.headline} outline={outline} page={page} />
      <div className={styles.columns} data-columns={view.showPromises ? 3 : 2}>
        {view.showPromises ? (
          <Column kind="promise" mark="✓" title={view.promisesLabel}>
            <Items items={view.promises} model={model} none="Nothing promised yet." />
          </Column>
        ) : null}
        <Column kind="wont" mark="✕" title="We won’t">
          <Items items={view.wont} model={model} none="Nothing ruled out yet." />
        </Column>
        <Column kind="budget" mark="◷" title="Time budget">
          <p className={styles.appetite}>{view.appetite ?? 'No time budget set'}</p>
          <p className={styles.note}>
            How long we will spend. If the work grows, we cut scope, not time.
          </p>
          {view.milestones.length === 0 ? null : (
            <ol className={styles.milestones}>
              {view.milestones.map((m) => (
                <li className={styles.milestone} key={m.id}>
                  <span className={styles.milestoneMark}>{m.mark}</span>
                  <span>{m.text}</span>
                </li>
              ))}
            </ol>
          )}
        </Column>
      </div>
    </>
  );
}
