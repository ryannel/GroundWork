import type { ReactNode } from 'react';

import type { Model } from '@/application/plan/derive';
import {
  envMeans,
  envsInOrder,
  GAP,
  levelWord,
  PLANNED,
  runsLine,
  testInfo,
} from '@/application/plan-viz-tests';
import { countOf } from '@/application/plan-viz-text';
import { ModelInline } from '@/features/plan/common/model-text';
import { TeamTag } from '@/features/plan/common/team-dot';
import { NoneMark, TestButton } from '@/features/plan/common/test-button';
import { RowDetail, type DetailCell } from '@/features/plan/viz/row-detail/row-detail.client';
import { Badge } from '@/ui/badge';
import { Glyph } from '@/ui/icon';

import styles from './coverage-row.module.css';

export type CoverageData = ReturnType<Model['coverage']>['rows'][number];

/** What a count opens: the tests at one level of one change. Replaces the plain list of test buttons. */
export type CoverageDetail = (change: string, level: string, tests: readonly string[]) => ReactNode;

interface CoverageRowProps {
  readonly model: Model;
  readonly row: CoverageData;
  readonly levels: readonly string[];
  /** The team to tag the change with, when the rows span several teams. */
  readonly team?: string | undefined;
  readonly detail?: CoverageDetail | undefined;
}

/** The loud empty cell: a gap a flag names. Weight and glyph carry it; colour stays for diff status. */
function Loud({ word }: { readonly word: string }) {
  return (
    <span className={styles.loud} title={`No ${word} test for this change`}>
      <span aria-hidden="true" className={styles.warn}>
        <Glyph glyph="⚠" />
      </span>
      <span className={styles.sr}>no {word} test</span>
    </span>
  );
}

function emptyCell(
  row: CoverageData,
  level: string,
): { readonly state: string; readonly node: ReactNode } {
  const word = levelWord(level);
  if (row.gaps.includes('untested') || (row.gaps.includes('no-e2e') && level === 'e2e')) {
    return { state: 'loud', node: <Loud word={word} /> };
  }
  const state = row.gaps.includes('unit-only') ? 'outlined' : 'plain';
  return { state, node: <NoneMark title={`No ${word} test for this change`} /> };
}

function levelCell(props: CoverageRowProps, level: string): DetailCell {
  const { model, row, detail } = props;
  const ids = row.byLevel[level] ?? [];
  const word = levelWord(level);
  if (ids.length === 0) {
    const { state, node } = emptyCell(row, level);
    return {
      key: level,
      align: 'center',
      content: (
        <span className={styles.empty} data-state={state}>
          {node}
        </span>
      ),
    };
  }
  return {
    key: level,
    align: 'center',
    button: {
      text: String(ids.length),
      glyph: PLANNED,
      title: `${word[0]?.toUpperCase() ?? ''}${word.slice(1)} tests`,
      label: countOf(ids.length, `planned ${word} test`),
      names: ids.map((t) => testInfo(model, t).name),
      body:
        detail === undefined ? (
          <div className={styles.tests}>
            {ids.map((t) => (
              <TestButton id={t} key={t} model={model} />
            ))}
          </div>
        ) : (
          detail(row.change, level, ids)
        ),
    },
  };
}

function Gaps({ gaps }: { readonly gaps: readonly string[] }) {
  return gaps.map((g) => (
    <span
      className={styles.flag}
      data-loud={g === 'unit-only' ? '' : undefined}
      key={g}
      title={GAP[g]?.means ?? g}
    >
      <Badge>
        {g === 'unit-only' ? (
          <span aria-hidden="true">
            <Glyph glyph="⚠" />{' '}
          </span>
        ) : null}
        {GAP[g]?.word ?? g}
      </Badge>
    </span>
  ));
}

function Head({ model, row, team }: Pick<CoverageRowProps, 'model' | 'row' | 'team'>) {
  const envs = envsInOrder(row.envs);
  return (
    <span className={styles.head}>
      <button className={styles.title} data-inspect={row.change} type="button">
        <span aria-hidden="true">
          <Glyph glyph="Δ" />
        </span>
        <span>
          {row.title === '' ? (
            model.label(row.change)
          ) : (
            <ModelInline model={model} text={row.title} />
          )}
        </span>
      </button>
      <span className={styles.meta}>
        {team === undefined ? null : <TeamTag model={model} teamId={team} />}
        <Gaps gaps={row.gaps} />
        {envs.length === 0 ? null : (
          <span className={styles.runs} title="Where the tests run">
            {runsLine(envs)}
          </span>
        )}
      </span>
    </span>
  );
}

function Env({ envs }: { readonly envs: readonly string[] }) {
  return (
    <span className={styles.envs}>
      {envs.length === 0 ? <NoneMark title="No test runs anywhere yet" /> : null}
      {envsInOrder(envs).map((e) => (
        <span key={e} title={envMeans(e)}>
          <Badge>{e}</Badge>
        </span>
      ))}
    </span>
  );
}

/** One change of the coverage matrix: its title, a count per level, where it runs, and the panels the counts open. */
export function CoverageRow(props: CoverageRowProps) {
  const { model, row, levels, team } = props;
  const cells: DetailCell[] = [
    { key: 'change', content: <Head model={model} row={row} team={team} /> },
    ...levels.map((l) => levelCell(props, l)),
    { key: 'env', content: <Env envs={row.envs} /> },
  ];
  return <RowDetail cells={cells} />;
}
