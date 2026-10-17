import type { ReactNode } from 'react';

import type { Model } from '@/application/plan/derive';
import { type Show, fadesIn, inCut, searchText, teamsWhere } from '@/application/plan-story-ref';
import { graphTypeFacts, schemaFacts, schemaGroups } from '@/application/plan-story-ref-system';
import { schemaCounts } from '@/application/plan-viz-fields';
import { countOf } from '@/application/plan-viz-text';
import type { SchemaNode } from '@/domain/plan/plan-graph';
import { ModelInline } from '@/features/plan/common/model-text';

import {
  Cell,
  type CatProps,
  Group,
  Pages,
  RefChip,
  RefChips,
  RefTable,
  rowAttrs,
  teamGroup,
} from './catalogue-bits';
import { StatusCell } from './status-cell';

const KIND: Readonly<Record<string, string>> = {
  dto: 'request or response body',
  payload: 'event data',
};

interface RowProps {
  readonly model: Model;
  readonly show: Show;
  readonly s: SchemaNode;
}

const attrs = ({ model, show, s }: RowProps) =>
  rowAttrs(
    searchText(
      s.name,
      s.id,
      s.kind,
      s.summary,
      s.fields.map((f) => f.name),
    ),
    teamsWhere(model, (cut) => inCut(model, cut, s.id)),
    fadesIn(model, show, s.id),
  );

function Size({ model, show, s }: RowProps) {
  const f = schemaFacts(model, show, s);
  const c = show === 'diff' ? schemaCounts(model, s.id) : null;
  const moved = c === null ? 0 : c.added + c.modified + c.deprecated + c.removed;
  return (
    <>
      {countOf(f.fields, 'field')}
      {moved > 0 ? <small> · {countOf(moved, 'change')}</small> : null}
    </>
  );
}

function Status({ model, show, s }: RowProps) {
  return show === 'diff' ? (
    <Cell label="status">
      <StatusCell id={s.id} model={model} show={show} />
    </Cell>
  ) : null;
}

function RecordRow({ model, show, s }: RowProps) {
  return (
    <tr {...attrs({ model, show, s })}>
      <Cell label="record">
        <RefChip id={s.id} model={model} quiet={show !== 'diff'} />
      </Cell>
      <Cell label="size">
        <Size model={model} show={show} s={s} />
      </Cell>
      <Cell label="what it holds" wide>
        <ModelInline model={model} text={s.summary ?? ''} />
      </Cell>
      <Status model={model} show={show} s={s} />
    </tr>
  );
}

function BodyRow({ model, show, s }: RowProps) {
  const by = schemaFacts(model, show, s).carriedBy;
  return (
    <tr {...attrs({ model, show, s })}>
      <Cell label="schema">
        <RefChip id={s.id} model={model} quiet={show !== 'diff'} />
      </Cell>
      <Cell label="kind">{KIND[s.kind] ?? s.kind}</Cell>
      <Cell label="size">
        <Size model={model} show={show} s={s} />
      </Cell>
      <Cell label="carried by">
        <RefChips ids={by} model={model} quiet={show !== 'diff'} />
      </Cell>
      <Cell label="what it holds" wide>
        <ModelInline model={model} text={s.summary ?? ''} />
      </Cell>
      <Status model={model} show={show} s={s} />
    </tr>
  );
}

function GraphRow({ model, show, s }: RowProps) {
  const g = graphTypeFacts(model, show, s.id);
  const quiet = show !== 'diff';
  return (
    <tr {...attrs({ model, show, s })}>
      <Cell label="type">
        <RefChip id={s.id} model={model} quiet={quiet} />
        {s.root === undefined ? null : <small>root {s.root}</small>}
      </Cell>
      <Cell label="key">{g.keys.length === 0 ? '—' : g.keys.join(' · ')}</Cell>
      <Cell label="fields">
        <Size model={model} show={show} s={s} />
      </Cell>
      <Cell label="owned by">
        <RefChips ids={g.contributors} model={model} quiet={quiet} />
      </Cell>
      <Cell label="selected by">
        <RefChips ids={g.operations} model={model} quiet={quiet} />
      </Cell>
      <Status model={model} show={show} s={s} />
    </tr>
  );
}

const head = (show: Show, cols: readonly string[]): string[] =>
  show === 'diff' ? [...cols, 'status'] : [...cols];

const SECTIONS = [
  {
    key: 'bodies',
    title: 'Request and event bodies',
    note: 'what an endpoint takes and returns, and the data an event carries',
    cols: ['schema', 'kind', 'size', 'carried by', 'what it holds'],
    Row: BodyRow,
  },
  {
    key: 'graphTypes',
    title: 'Graph types',
    note: 'what the front end can ask for, and which subgraph owns each field',
    cols: ['type', 'key', 'fields', 'owned by', 'selected by'],
    Row: GraphRow,
  },
] as const;

function blocks(model: Model, show: Show): ReactNode[] {
  const g = schemaGroups(model, show);
  const records = g.records.map(({ store, schemas }) => (
    <Group
      count={schemas.length}
      key={store}
      team={teamGroup(model, store)}
      title={<RefChip id={store} model={model} quiet={show !== 'diff'} />}
    >
      <RefTable head={head(show, ['record', 'size', 'what it holds'])}>
        {schemas.map((s) => (
          <RecordRow key={s.id} model={model} s={s} show={show} />
        ))}
      </RefTable>
    </Group>
  ));
  const others = SECTIONS.filter((sec) => g[sec.key].length > 0).map(
    ({ key, title, note, cols, Row }) => (
      <Group count={g[key].length} key={key} note={note} title={title}>
        <RefTable head={head(show, cols)}>
          {g[key].map((s) => (
            <Row key={s.id} model={model} s={s} show={show} />
          ))}
        </RefTable>
      </Group>
    ),
  );
  return [...records, ...others];
}

/** Records by the store that holds them, request and event bodies, and the graph's types. */
export function SchemasCat({ model, teams, today }: CatProps) {
  return (
    <Pages
      today={today}
      empty="No schemas."
      model={model}
      modes
      noun="schemas"
      render={(show) => blocks(model, show)}
      teams={teams}
    />
  );
}
