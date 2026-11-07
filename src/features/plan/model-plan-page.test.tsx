// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';

import { modelOp } from '@/../test/fixtures/model-op';
import { queryModel } from '@/../test/fixtures/model-queries';
import type { ModelFlowView } from '@/application/model-flow';
import { modelPlanOutline } from '@/application/model-plan-pages';
import { modelPlanProgressOf } from '@/application/model-progress';
import { modelContextOf } from '@/application/model-reader';
import {
  unpackModelSystemMap,
  type ModelSystemMapWire,
} from '@/application/model-system-map-transport';
import type { SystemMapInput } from '@/application/plan-viz-system-map-types';
import { apply } from '@/domain/plan-apply';
import type { ModelPlan, WorkspaceModel } from '@/domain/workspace-model';

import { ModelPlanPage, ModelPlanThingPage, type ModelPlanPageProps } from './model-plan-page';

vi.mock(import('./plan-frame'), () => ({
  PlanFrame: ({ children }: { readonly children: ReactNode }) => <main>{children}</main>,
}));
vi.mock(import('./viz/system-map/system-map.client'), () => ({
  SystemMapView: ({
    packed,
    input,
  }: {
    readonly packed?: ModelSystemMapWire;
    readonly input?: SystemMapInput;
  }) => {
    const drawing = packed === undefined ? input : unpackModelSystemMap(packed);
    if (drawing === undefined) throw new Error('The map needs its actual input.');
    return (
      <div>
        <span>Native map drawing</span>
        <span data-testid="map-names">
          {drawing.services.map((service) => service.name).join(' | ')}
        </span>
      </div>
    );
  },
}));
vi.mock(import('./today/model-today-flow'), () => ({
  ModelTodayFlow: ({ flow }: { readonly flow: ModelFlowView }) => (
    <div>Walking {flow.source.name}</div>
  ),
}));
afterEach(cleanup);
const plan: ModelPlan = {
  meta: {
    id: 'plan:presentation',
    title: 'A native plan',
    status: 'review',
    version: '2.0',
    revisions: [
      {
        version: '2.0',
        status: 'proposed',
        date: '2026-11-07',
        summary: 'A proposed revision',
        why: 'Keep a **qualified** explanation',
        pr: 72,
      },
    ],
  },
  problem: {
    summary: 'Keep the **qualified** behaviour of [[api:a]].',
    why: 'Read [the original source](https://example.test/source).',
  },
  story: { summary: 'A whole story with [[api:a]].', scope: ['api:a'] },
  changes: [
    {
      id: 'chg:qualify',
      title: 'Qualify behaviour',
      requires: [{ id: 'req:scope', text: 'The complete assigned requirement.' }],
      ops: [{ modify: 'h:a' }],
    },
  ],
  questions: [
    {
      id: 'q:review',
      question: 'Who verifies the selected scope?',
      status: 'open',
      decider: 'team:a',
    },
  ],
  risks: [
    {
      id: 'risk:check',
      statement: 'The proposed scope may be incomplete.',
      likelihood: 'low',
      impact: 'high',
      owner: 'team:a',
    },
  ],
  work_items: [
    {
      id: 'wi:done',
      title: 'Recorded completed work',
      team: 'team:a',
      needed_by: '2026-11-09',
      body: 'Preserve the qualification.',
      implements: ['chg:qualify'],
    },
    { id: 'wi:unknown', title: 'Work with no GitHub state', team: 'team:a' },
  ],
};
function data(): ModelPlanPageProps {
  const model = queryModel();
  const progress = modelPlanProgressOf({
    progress: {
      events: [
        {
          at: '2026-11-07',
          subject: 'wi:done',
          kind: 'work',
          state: 'done',
          note: 'The sync recorded completion.',
          source: { kind: 'github', repo: 'fixture/a', issue: 3 },
        },
        {
          at: '2026-11-08',
          subject: 'wi:unknown',
          kind: 'note',
          note: 'Waiting for a person.',
          said_by: 'A reviewer',
        },
      ],
    },
    errors: [],
  });
  const context = { ...modelContextOf({ plan, before: model, after: model }), progress };
  return {
    context,
    outline: modelPlanOutline(context, { workspace: 'queries', slug: 'native' }),
    workspaceName: 'Queries',
    plans: [],
    progress,
    snapshots: [],
  };
}
it('draws the real cover, rich text, exact change link and all chapter doors', () => {
  render(<ModelPlanPage {...data()} />);
  expect(screen.getByRole('heading', { name: 'A native plan', level: 1 })).toBeTruthy();
  expect(screen.getAllByText('qualified', { selector: 'strong' })[0]).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Qualify behaviour' }).getAttribute('href')).toBe(
    '/queries/plans/native/changes/chg-qualify',
  );
  expect(screen.getByRole('link', { name: '1 · Why' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'V · Versions' })).toBeTruthy();
});
it('preserves authored source links and headings in a native chapter', () => {
  render(<ModelPlanPage {...data()} chapter="why" screen="problem" />);
  expect(screen.getByRole('link', { name: 'the original source' }).getAttribute('href')).toBe(
    'https://example.test/source',
  );
  expect(screen.getByRole('heading', { name: 'The problem', level: 1 })).toBeTruthy();
});
it('shows actual GitHub state separately from unknown state and retains progress notes, dates and sources', () => {
  render(<ModelPlanPage {...data()} chapter="build" screen="work-by-team" />);
  expect(screen.getByText('closed')).toBeTruthy();
  expect(screen.getByText('GitHub state unknown')).toBeTruthy();
  expect(screen.getAllByText('The sync recorded completion.')[0]).toBeTruthy();
  expect(screen.getAllByText('Waiting for a person.')[0]).toBeTruthy();
  expect(screen.getByRole('link', { name: 'GitHub issue' }).getAttribute('href')).toBe(
    'https://github.com/fixture/a/issues/3',
  );
  expect(screen.getByText('Closed 2026-11-07')).toBeTruthy();
  expect(screen.getByText('Recorded by A reviewer')).toBeTruthy();
});
it('draws the selected native map and keeps the proposal qualification visible', () => {
  render(<ModelPlanPage {...data()} chapter="changes" screen="system" />);
  expect(screen.getByText('Native map drawing')).toBeTruthy();
  expect(screen.getByText(/Implementation remains unverified/u)).toBeTruthy();
  expect(
    screen.getByRole('link', { name: 'Show before this plan' }).getAttribute('href'),
  ).toContain('view=before');
});
it('retains all version metadata and an actual saved snapshot', () => {
  render(
    <ModelPlanPage
      {...data()}
      snapshots={[
        {
          version: '2.0',
          plan: {
            meta: { id: plan.meta.id, title: 'Saved snapshot' },
            problem: { summary: 'Saved exact text' },
            changes: [],
          },
        },
      ]}
      chapter="versions"
      screen="v2.0"
    />,
  );
  expect(screen.getByText('Keep a', { exact: false })).toBeTruthy();
  expect(screen.getByText('Saved exact text')).toBeTruthy();
  expect(screen.getByText('72')).toBeTruthy();
});
it('keeps a removed fact inspectable in before without presenting it in after', () => {
  const current = data();
  const after: WorkspaceModel = { ...current.context.beforeIndex.model, externals: [] };
  const context = modelContextOf({ plan, before: current.context.beforeIndex.model, after });
  const { unmount } = render(
    <ModelPlanThingPage {...current} context={context} token="ext-supplier" />,
  );
  expect(screen.getByText('Not present in this view')).toBeTruthy();
  unmount();
  render(
    <ModelPlanThingPage
      {...current}
      context={context}
      token="ext-supplier"
      searchParams={{ view: 'before' }}
    />,
  );
  expect(screen.getByRole('heading', { name: 'Supplier', level: 1 })).toBeTruthy();
});
it('keeps before prose labels on the recorded names and after prose labels on proposed names', () => {
  const current = data();
  const source = queryModel();
  const before: WorkspaceModel = {
    ...source,
    domains: source.domains.map((domain) => ({
      ...domain,
      systems: domain.systems.map((system) => ({
        ...system,
        components: system.components.map((component) =>
          component.id === 'svc:a'
            ? { ...component, summary: 'The recorded [[svc:a]] reference.' }
            : component,
        ),
      })),
    })),
  };
  const after: WorkspaceModel = {
    ...before,
    domains: before.domains.map((domain) => ({
      ...domain,
      systems: domain.systems.map((system) => ({
        ...system,
        components: system.components.map((component) =>
          component.id === 'svc:a' ? { ...component, name: 'Proposed A' } : component,
        ),
      })),
    })),
  };
  const context = modelContextOf({ plan, before, after });
  const { unmount } = render(
    <ModelPlanThingPage
      {...current}
      context={context}
      token="svc-a"
      searchParams={{ view: 'before' }}
    />,
  );
  expect(screen.getAllByRole('button', { name: 'A' }).length).toBeGreaterThan(0);
  expect(screen.queryByRole('button', { name: 'Proposed A' })).toBeNull();
  unmount();
  render(<ModelPlanThingPage {...current} context={context} token="svc-a" />);
  expect(screen.getAllByRole('button', { name: 'Proposed A' }).length).toBeGreaterThan(0);
});
it('opens the assigned team part instead of repeating the cover', () => {
  const { unmount } = render(
    <ModelPlanPage {...data()} chapter="cover" screen="part" lens="team:a" />,
  );
  expect(screen.getByRole('heading', { name: 'Your part', level: 1 })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Recorded completed work' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'A native plan', level: 1 })).toBeNull();
  expect(screen.getByRole('link', { name: 'Qualify behaviour' }).getAttribute('href')).toBe(
    '/queries/plans/native/changes/chg-qualify',
  );
  expect(screen.getAllByRole('link', { name: 'Work item detail' })[0]?.getAttribute('href')).toBe(
    '/queries/plans/native/things?id=wi-done',
  );
  expect(
    screen.getByRole('link', { name: 'Who verifies the selected scope?' }).getAttribute('href'),
  ).toBe('/queries/plans/native/things?id=q-review');
  expect(
    screen
      .getByRole('link', { name: 'The proposed scope may be incomplete.' })
      .getAttribute('href'),
  ).toBe('/queries/plans/native/things?id=risk-check');
  expect(screen.queryByText('The complete assigned requirement.')).toBeNull();
  unmount();
  render(<ModelPlanPage {...data()} chapter="changes" screen="chg-qualify" />);
  expect(screen.getByText('The complete assigned requirement.')).toBeTruthy();
});
it('keeps commitment promises and confidence distinct from completed work', () => {
  const current = data();
  const progress = modelPlanProgressOf({
    progress: {
      events: [
        {
          at: '2026-11-06',
          subject: 'wi:done',
          kind: 'commitment',
          state: 'accepted',
          promised_for: '2026-11-10',
          confidence: 'medium',
          said_by: 'The assigned team',
          note: 'The recorded promise.',
          source: { kind: 'meeting', url: 'https://example.test/commitment' },
        },
      ],
    },
    errors: [],
  });
  render(<ModelPlanPage {...current} progress={progress} chapter="build" screen="progress" />);
  expect(screen.getByText('Accepted')).toBeTruthy();
  expect(screen.getByText('Promised for 2026-11-10')).toBeTruthy();
  expect(screen.getByText('Confidence: medium')).toBeTruthy();
  expect(screen.getByText('Recorded by The assigned team')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Recorded source' }).getAttribute('href')).toBe(
    'https://example.test/commitment',
  );
  expect(screen.queryByText('closed')).toBeNull();
});

it('defaults Today to before while an explicit after selection draws the supplied proposed map', () => {
  const current = data();
  const before = current.context.beforeIndex.model;
  const after: WorkspaceModel = {
    ...before,
    domains: before.domains.map((domain) => ({
      ...domain,
      systems: domain.systems.map((system) => ({
        ...system,
        components: system.components.map((component) =>
          component.id === 'svc:a' ? { ...component, name: 'Proposed A' } : component,
        ),
      })),
    })),
  };
  const context = modelContextOf({ plan, before, after });
  const { unmount } = render(
    <ModelPlanPage {...current} context={context} chapter="today" screen="system" />,
  );
  expect(screen.getByTestId('map-names').textContent).not.toContain('Proposed A');
  unmount();
  render(
    <ModelPlanPage
      {...current}
      context={context}
      chapter="today"
      screen="system"
      searchParams={{ view: 'after' }}
    />,
  );
  expect(screen.getByTestId('map-names').textContent).toContain('Proposed A');
});

it('opens the exact selected changed flow without hiding the other recorded flows', () => {
  const current = data();
  const flows = ['alpha', 'beta', 'gamma', 'delta'].map((name) => ({
    id: `flow:${name}`,
    name: `Flow ${name}`,
    steps: [],
  }));
  const source: WorkspaceModel = { ...current.context.afterIndex.model, flows };
  const flowPlan: ModelPlan = {
    ...plan,
    changes: flows.map((flow) => ({
      id: `chg:${flow.id.slice(5)}`,
      title: flow.name,
      ops: [modelOp({ modify: flow.id, set: { name: flow.name } })],
    })),
  };
  const context = modelContextOf({ plan: flowPlan, before: source, after: source });
  const outline = modelPlanOutline(context, { workspace: 'queries', slug: 'native' });
  render(
    <ModelPlanPage
      {...current}
      context={context}
      outline={outline}
      chapter="changes"
      screen="flows"
      searchParams={{ flow: 'flow:beta', view: 'before', team: 'team:a' }}
    />,
  );
  expect(screen.getByText('Walking Flow beta')).toBeTruthy();
  expect(screen.queryByText('Walking Flow alpha')).toBeNull();
  const alphaLinks = screen.getAllByRole('link', { name: 'Flow alpha' });
  expect(
    alphaLinks.some((link) => link.getAttribute('href')?.includes('flow=flow%3Aalpha') === true),
  ).toBe(true);
  const alphaWalk = alphaLinks.find(
    (link) => link.getAttribute('href')?.includes('flow=flow%3Aalpha') === true,
  );
  expect(alphaWalk?.getAttribute('href')).toContain('view=before');
  expect(alphaWalk?.getAttribute('href')).toContain('team=team%3Aa');
});

it('lists graphs without repeating their nested fields and links to their exact before detail', () => {
  const current = data();
  const declaration = modelOp({
    add: 'graph',
    value: {
      id: 'graph:recorded',
      name: 'Recorded graph',
      summary: 'The recorded graph overview.',
      composition: { evidence: 'The complete graph composition.' },
      subgraphs: [
        {
          id: 'sg:recorded',
          graph: 'graph:recorded',
          name: 'Recorded subgraph',
          component: 'svc:a',
        },
      ],
    },
  });
  const before = apply([declaration], current.context.beforeIndex.model);
  const context = modelContextOf({ plan, before, after: before });
  const { unmount } = render(
    <ModelPlanPage {...current} context={context} chapter="today" screen="graph" />,
  );
  expect(screen.getByRole('link', { name: 'Recorded graph' }).getAttribute('href')).toBe(
    '/queries/plans/native/things?id=graph-recorded&view=before',
  );
  expect(screen.getByRole('link', { name: 'Recorded subgraph' }).getAttribute('href')).toBe(
    '/queries/plans/native/things?id=sg-recorded&view=before',
  );
  expect(screen.getByText('The recorded graph overview.')).toBeTruthy();
  expect(screen.queryByText('The complete graph composition.')).toBeNull();
  unmount();
  render(
    <ModelPlanThingPage
      {...current}
      context={context}
      token="graph-recorded"
      searchParams={{ view: 'before' }}
    />,
  );
  expect(screen.getByText('The complete graph composition.')).toBeTruthy();
});
