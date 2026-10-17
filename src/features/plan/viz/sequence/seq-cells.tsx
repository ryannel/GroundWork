import type { SeqCell } from '@/application/plan-viz-sequence-cells';

import { Act } from './seq-act';
import { ArrowLane, SelfLane } from './seq-arrow';
import styles from './seq-cells.module.css';
import type { SeqEnv } from './seq-env';
import { LaneItem, Lifelines } from './seq-lanes';
import { Row } from './seq-row';

/** One row of the drawing, by what it is: a step, the way in or a reply, the trigger, a group's tab or an else. */
export function Cell({ env, cell }: { readonly env: SeqEnv; readonly cell: SeqCell }) {
  const { cols } = env;
  switch (cell.kind) {
    case 'group': {
      return (
        <Row act={<span className={styles.tab}>{cell.tab}</span>} gut={cell.gut} kind="group" />
      );
    }
    case 'else': {
      return (
        <Row act={<span className={styles.tab}>if it fails</span>} gut={cell.gut} kind="else">
          <LaneItem place={{ start: 1, span: cols * 2 }}>
            <span className={styles.else}>{cell.text}</span>
          </LaneItem>
        </Row>
      );
    }
    case 'link': {
      return (
        <Row gut={cell.gut} kind="link">
          <Lifelines cols={cols} />
          <ArrowLane arrow={cell.arrow} />
        </Row>
      );
    }
    case 'trigger': {
      return (
        <Row gut={cell.gut} kind="trigger">
          <Lifelines cols={cols} />
          <LaneItem align="end" place={cell.place}>
            <span className={styles.trigger}>
              <span aria-hidden="true">⏱</span> {cell.text}
            </span>
          </LaneItem>
        </Row>
      );
    }
    case 'step': {
      return (
        <Row
          act={<Act env={env} step={cell} />}
          at={cell.index}
          go={env.action === 'go' ? cell.index : undefined}
          gut={cell.gut}
          isNew={cell.isNew}
          kind="step"
          n={cell.index + 1}
          status={cell.status}
          walk={cell.walk}
        >
          <Lifelines cols={cols} />
          {cell.self === null ? null : <SelfLane self={cell.self} />}
          {cell.arrow === null ? null : <ArrowLane arrow={cell.arrow} />}
        </Row>
      );
    }
  }
}
