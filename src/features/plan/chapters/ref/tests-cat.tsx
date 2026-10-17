import type { Model } from '@/application/plan/derive';
import { searchText, teamsWhere } from '@/application/plan-story-ref';
import { testsByLevel, walksText } from '@/application/plan-story-ref-rows';
import { LEVEL_MEANS, levelWord } from '@/application/plan-viz-tests';
import type { Test } from '@/domain/plan/plan.generated';
import { TeamTag } from '@/features/plan/common/team-dot';
import { PyramidStrip } from '@/features/plan/viz/matrix/pyramid-strip';

import {
  Cell,
  type CatProps,
  Group,
  Pages,
  RefChip,
  RefChips,
  RefTable,
  rowAttrs,
} from './catalogue-bits';

const envWord = (env: Test['env']): string => {
  if (env === undefined) return '—';
  return env === 'ci' ? 'every build' : env;
};

const HEAD = ['test', 'owner', 'runs on', 'proves', 'steps it runs'];

function TestRow({ model, t }: { readonly model: Model; readonly t: Test }) {
  const search = searchText(
    t.name,
    t.id,
    t.level,
    t.env,
    t.owner === undefined ? '' : model.label(t.owner),
    [t.given, t.when, t.then],
    t.proves.map((p) => model.label(p)),
  );
  return (
    <tr
      {...rowAttrs(
        search,
        teamsWhere(model, (cut) => cut.tests.includes(t.id)),
      )}
    >
      <Cell label="test">
        <RefChip id={t.id} model={model} quiet />
      </Cell>
      <Cell label="owner">
        {t.owner === undefined ? '—' : <TeamTag model={model} teamId={t.owner} />}
      </Cell>
      <Cell label="runs on">{envWord(t.env)}</Cell>
      <Cell label="proves">
        <RefChips ids={t.proves} model={model} quiet />
      </Cell>
      <Cell label="steps it runs">{walksText(t) === '' ? '—' : walksText(t)}</Cell>
    </tr>
  );
}

/** What proves each change, by level. */
export function TestsCat({ model, teams }: CatProps) {
  const levels = testsByLevel(model.plan.tests ?? []);
  return (
    <Pages
      empty="This plan records no tests."
      model={model}
      modes={false}
      noun="tests"
      render={() =>
        levels.length === 0
          ? []
          : [
              <PyramidStrip key="pyramid" lensed model={model} />,
              ...levels.map(({ level, tests }) => (
                <Group
                  count={tests.length}
                  key={level}
                  note={LEVEL_MEANS[level] ?? ''}
                  title={levelWord(level)}
                >
                  <RefTable head={HEAD}>
                    {tests.map((t) => (
                      <TestRow key={t.id} model={model} t={t} />
                    ))}
                  </RefTable>
                </Group>
              )),
            ]
      }
      teams={teams}
    />
  );
}
