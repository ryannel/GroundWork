// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { afterEach, expect, it, vi } from 'vitest';

import { flowFixture } from '@/../test/fixtures/model-current-flow';
import { modelOp } from '@/../test/fixtures/model-op';
import { queryModel } from '@/../test/fixtures/model-queries';
import { modelInspectionOf } from '@/application/model-inspection';
import {
  currentModelPayload,
  modelContextOf,
  selectedPlanPayload,
} from '@/application/model-reader';
import { selectedPlanProjection } from '@/application/plans-index';
import { planReaderOf } from '@/application/thing-paths';
import { todayReaderOf } from '@/application/today-reader';
import type { ModelPlan, WorkspaceModel } from '@/domain/workspace-model';

import { NativeThing, NativeThingLoader } from './native-thing.client';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('renders a supplied native record with its declared ownership and recorded detail', () => {
  render(
    <NativeThing
      id="svc:a"
      reader={todayReaderOf('queries', 0)}
      head={modelContextOf({ model: queryModel() })}
    />,
  );
  expect(screen.getByRole('heading', { name: 'A', level: 2 })).toBeTruthy();
  expect(screen.getByText('Owned by')).toBeTruthy();
  expect(screen.getByText('Recorded detail')).toBeTruthy();
});

it('switches the supplied plan facts without treating proposed before context as implemented today', () => {
  const plan: ModelPlan = {
    meta: { id: 'plan:inspect', title: 'Qualify the request' },
    problem: { summary: 'Keep the before facts visible.' },
    changes: [
      {
        id: 'chg:approval',
        title: 'Require approval',
        ops: [modelOp({ modify: 'h:a#call', set: { when: 'Recorded approval is present' } })],
      },
    ],
  };
  const projection = selectedPlanProjection(plan, [plan], queryModel());
  const head = modelContextOf(selectedPlanPayload(projection));
  render(<NativeThing id="h:a#call" reader={todayReaderOf('queries', 0)} head={head} />);
  expect(screen.getByText('Recorded approval is present')).toBeTruthy();
  expect(screen.getByText(/implementation is unverified/u)).toBeTruthy();
  fireEvent.click(screen.getByLabelText('before this plan'));
  expect(screen.queryByText('Recorded approval is present')).toBeNull();
  expect(screen.queryByLabelText('today')).toBeNull();
});

it('loads omitted evidence explicitly and does not call it missing while the request is pending', async () => {
  const full: WorkspaceModel = {
    ...queryModel(),
    evidence: [
      {
        repository: {
          format: 'groundwork-evidence/v2',
          repo: 'fixture/a',
          commit: 'a'.repeat(40),
          scannedAt: '2026-11-07',
          language: 'typescript',
          trackedFiles: 1,
          selectedFiles: 1,
          passes: ['source'],
        },
        records: [
          {
            family: 'files',
            data: { kind: 'file', id: 'ev:file', path: 'src/a.ts', blob: 'b'.repeat(40) },
          },
        ],
        discovery: null,
      },
    ],
  };
  const inspection = modelInspectionOf(modelContextOf({ model: full }), 'ev:file');
  const context = modelContextOf(currentModelPayload(full));
  expect(context.afterIndex.get('ev:file')).toBeNull();
  const pending = Promise.withResolvers<Response>();
  const fetch = vi.fn<typeof globalThis.fetch>().mockReturnValue(pending.promise);
  vi.stubGlobal('fetch', fetch);
  vi.stubGlobal('location', new URL('http://localhost/queries/things/'));
  render(<NativeThing id="ev:file" reader={todayReaderOf('queries', 1)} head={context} />);
  expect(screen.getByText('Loading evidence…')).toBeTruthy();
  expect(screen.queryByText('Evidence not recorded')).toBeNull();
  await act(async () => {
    pending.resolve(Response.json({ inspection }));
    await pending.promise;
  });
  await expect(screen.findByRole('heading', { name: 'ev:file', level: 2 })).resolves.toBeTruthy();
  expect(screen.getByText('fixture/a')).toBeTruthy();
  expect(fetch).toHaveBeenCalledWith('http://localhost/queries/evidence.json?id=ev%3Afile', {
    cache: 'no-store',
  });
});

it('uses the selected before name in both the detail and inspector breadcrumb', () => {
  const plan: ModelPlan = {
    meta: { id: 'plan:rename', title: 'Rename A' },
    problem: { summary: 'Keep both names.' },
    changes: [
      {
        id: 'chg:name',
        title: 'Rename',
        ops: [modelOp({ modify: 'svc:a', set: { name: 'Proposed A' } })],
      },
    ],
  };
  const head = modelContextOf(
    selectedPlanPayload(selectedPlanProjection(plan, [plan], queryModel())),
  );
  const { container } = render(
    <NativeThing id="svc:a" reader={todayReaderOf('queries', 0)} head={head} />,
  );
  expect(container.querySelector('[aria-current="page"]')?.textContent).toBe('Proposed A');
  fireEvent.click(screen.getByLabelText('before this plan'));
  expect(screen.getByRole('heading', { level: 2, name: 'A' })).toBeTruthy();
  expect(container.querySelector('[aria-current="page"]')?.textContent).toBe('A');
});
it('shows exact independent work notes and dates while an unrecorded issue state stays unknown', () => {
  const plan: ModelPlan = {
    meta: { id: 'plan:work', title: 'Work' },
    problem: { summary: 'Keep progress separate.' },
    changes: [],
    work_items: [{ id: 'wi:one', title: 'Recorded task', team: 'team:a' }],
  };
  const context = modelContextOf({
    plan,
    before: queryModel(),
    after: queryModel(),
    progress: {
      events: [
        {
          subject: 'wi:one',
          kind: 'note',
          at: '2026-11-07',
          note: 'Waiting for the named person.',
          promised_for: '2026-11-10',
          said_by: 'The reviewer',
          source: { kind: 'note', url: 'https://example.test/record' },
        },
      ],
      errors: [],
      status: {},
    },
  });
  render(<NativeThing id="wi:one" reader={todayReaderOf('queries', 0)} head={context} />);
  expect(screen.getByText('GitHub state unknown')).toBeTruthy();
  expect(screen.getAllByText('Waiting for the named person.').length).toBeGreaterThan(0);
  expect(screen.getByText('Promised for 2026-11-10')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Recorded source' }).getAttribute('href')).toBe(
    'https://example.test/record',
  );
  expect(screen.queryByText('Not started')).toBeNull();
});

it('keeps the authored flow and its copy action in native inspection', () => {
  render(
    <NativeThing
      id="flow:story"
      reader={todayReaderOf('queries', 0)}
      head={modelContextOf({ model: flowFixture() })}
    />,
  );
  expect(screen.getByRole('button', { name: 'Copy as Mermaid' })).toBeTruthy();
  expect(screen.getByText(/Authored narrative/u)).toBeTruthy();
  expect(screen.getAllByText('A precise trigger').length).toBeGreaterThan(0);
});
it('loads the exact saved native revision and reports a missing snapshot without deriving one', async () => {
  const model = queryModel();
  const before = {
    ...model,
    domains: model.domains.map((domain) => ({
      ...domain,
      systems: domain.systems.map((system) => ({
        ...system,
        components: system.components.map((component) =>
          component.id === 'svc:a' ? { ...component, name: 'A as recorded before' } : component,
        ),
      })),
    })),
  };
  const plan: ModelPlan = {
    meta: {
      id: 'plan:versions',
      title: 'Versions',
      version: '1.1',
      revisions: [
        { version: '1.0', status: 'approved', date: '2026-10-01' },
        { version: '1.1', status: 'proposed', date: '2026-11-01' },
        { version: '0.9', status: 'rejected', date: '2026-09-01' },
      ],
    },
    problem: { summary: 'Retain recorded snapshots.' },
    changes: [],
  };
  const request = vi.fn<typeof globalThis.fetch>().mockImplementation(async (source) => {
    await Promise.resolve();
    const supplied = source instanceof URL ? source.href : source;
    const address = typeof supplied === 'string' ? supplied : supplied.url;
    if (address.includes('/revisions/1.0/')) return Response.json({ plan, before, after: before });
    if (address.includes('/revisions/')) return new Response('Not kept', { status: 404 });
    return Response.json({ plan, before: model, after: model });
  });
  vi.stubGlobal('fetch', request);
  await act(async () => {
    render(
      <Suspense fallback={<p>Loading native facts</p>}>
        <NativeThingLoader
          id="svc:a"
          reader={planReaderOf(
            { workspace: 'queries', slug: 'actual' },
            'native-revision/plan.json',
          )}
        />
      </Suspense>,
    );
    await Promise.resolve();
  });
  const pick = await screen.findByRole('combobox', { name: 'As at' });
  await act(async () => {
    fireEvent.change(pick, { target: { value: '1.0' } });
    await Promise.resolve();
  });
  await expect(
    screen.findByRole('heading', { level: 2, name: 'A as recorded before' }),
  ).resolves.toBeTruthy();
  await act(async () => {
    fireEvent.change(screen.getByRole('combobox', { name: 'As at' }), { target: { value: '0.9' } });
    await Promise.resolve();
  });
  await expect(screen.findByText('No copy of version 0.9 was kept.')).resolves.toBeTruthy();
  expect(screen.getByRole('button', { name: 'Close the inspector' })).toBeTruthy();
  expect(request).toHaveBeenCalledTimes(3);
});
