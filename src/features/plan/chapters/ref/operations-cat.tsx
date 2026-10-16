import type { Model } from '@/application/plan/derive';
import { fadesIn, inCut, searchText, teamsWhere } from '@/application/plan-story-ref';
import {
  type OperationRow,
  operationsByScreen,
  triggerWord,
} from '@/application/plan-story-ref-rows';
import { countOf } from '@/application/plan-viz-text';
import { TeamTag } from '@/features/plan/common/team-dot';

import {
  Cell,
  type CatProps,
  Dots,
  teamGroup,
  Group,
  Pages,
  RefChip,
  RefChips,
  RefTable,
  rowAttrs,
} from './catalogue-bits';
import { StatusCell } from './status-cell';

const HEAD = ['operation', 'sent', 'fields', 'subgraphs', 'teams', 'cached for'];

function Row({
  model,
  row,
  diff,
}: {
  readonly model: Model;
  readonly row: OperationRow;
  readonly diff: boolean;
}) {
  const { op } = row;
  const search = searchText(
    op.name,
    op.id,
    op.kind,
    op.trigger,
    row.subgraphs.map((s) => model.label(s)),
    row.teams.map((t) => model.label(t)),
  );
  const mine = teamsWhere(
    model,
    (cut) =>
      inCut(model, cut, op.id) || row.teams.includes(cut.team) || row.teams.some((t) => cut.has(t)),
  );
  return (
    <tr {...rowAttrs(search, mine, fadesIn(model, diff ? 'diff' : 'tobe', op.id))}>
      <Cell label="operation">
        <RefChip id={op.id} model={model} quiet={!diff} />
        <small>{op.kind}</small>
      </Cell>
      <Cell label="sent">{triggerWord(op) === '' ? '—' : triggerWord(op)}</Cell>
      <Cell label="fields">{row.fields === 0 ? '—' : countOf(row.fields, 'field')}</Cell>
      <Cell label="subgraphs">
        <RefChips ids={row.subgraphs} model={model} quiet={!diff} />
      </Cell>
      <Cell label="teams">
        <Dots>
          {row.teams.map((t) => (
            <TeamTag key={t} model={model} teamId={t} />
          ))}
        </Dots>
      </Cell>
      <Cell label="cached for">{row.cached === '' ? '—' : row.cached}</Cell>
      {diff ? (
        <Cell label="status">
          <StatusCell id={op.id} model={model} show="diff" />
        </Cell>
      ) : null}
    </tr>
  );
}

/** What the front end asks the graph for, by screen. */
export function OperationsCat({ model, teams, today }: CatProps) {
  return (
    <Pages
      today={today}
      model={model}
      modes
      empty="No operations."
      noun="operations"
      render={(show) => {
        const groups = operationsByScreen(model, show);
        return groups.map(({ screen, rows }) => (
          <Group
            count={rows.length}
            key={screen}
            team={teamGroup(model, screen)}
            title={
              screen === '' ? (
                'Not tied to a screen'
              ) : (
                <RefChip id={screen} model={model} quiet={show !== 'diff'} />
              )
            }
          >
            <RefTable head={show === 'diff' ? [...HEAD, 'status'] : HEAD}>
              {rows.map((r) => (
                <Row diff={show === 'diff'} key={r.op.id} model={model} row={r} />
              ))}
            </RefTable>
          </Group>
        ));
      }}
      teams={teams}
    />
  );
}
