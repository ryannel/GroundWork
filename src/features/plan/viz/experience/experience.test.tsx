// @vitest-environment happy-dom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { sequencePlan } from '@/../test/sequence-kit';
import { derive } from '@/application/plan/derive';
import { flowExperience, type Moment } from '@/application/plan/flow-experience';
import { flowSteps } from '@/application/plan/flow-steps';
import { type ExperienceData, experienceOf, systemNav } from '@/application/plan-viz-experience';
import { stepStops } from '@/application/plan-viz-flow-stops';

import { Experience } from './experience';
import { LinkedScreenBlock } from './linked-screen';
import { SystemStepper } from './system-stepper';

vi.mock('server-only', () => ({}));

const model = derive(sequencePlan());
const flow = 'flow:rich';
const steps = flowSteps(model, flow, 'toBe');
const stops = stepStops(model, flow);
const moments = flowExperience(model, flow, 'toBe');
const base = '/plans/x/';

function dataAt(current: number, mode: 'toBe' | 'asIs' = 'toBe'): ExperienceData {
  const moment = moments[current];
  const selected = moment === undefined ? [] : moment.indices.slice(0, 1);
  const data = experienceOf(model, moments, { current, steps, stops, selected, mode });
  if (data === null) throw new Error('no such moment');
  return data;
}

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 600 });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 400 });
});
afterEach(cleanup);

describe('Experience', () => {
  it('shows the moments as buttons that go to their stop, the current one marked', () => {
    render(<Experience base={base} data={dataAt(0)} mode="toBe" model={model} />);
    const nav = screen.getByRole('navigation', { name: 'Moments in this flow' });
    const tabs = within(nav).getAllByRole('button');
    expect(tabs).toHaveLength(moments.length);
    expect(tabs[0]?.getAttribute('aria-current')).toBe('step');
    expect(tabs[0]?.dataset.step).toBe('1');
    expect(screen.getByText('The planned experience')).toBeTruthy();
  });

  it('says today for the as-is, and nothing when bare', () => {
    const { rerender } = render(
      <Experience base={base} data={dataAt(0, 'asIs')} mode="asIs" model={model} />,
    );
    expect(screen.getByText('The experience today')).toBeTruthy();
    rerender(<Experience bare base={base} data={dataAt(0, 'asIs')} mode="asIs" model={model} />);
    expect(screen.queryByText('The experience today')).toBeNull();
  });

  it('draws the screen and offers the trace and the next moment', () => {
    const acting: Moment = {
      kind: 'action',
      title: 'Ask',
      screen: 'scr:pdp',
      region: 'scr:pdp#hero',
      anchor: 0,
      indices: [0, 1],
    };
    const data = experienceOf(model, [acting, ...moments], {
      current: 0,
      steps,
      stops,
      selected: [0],
      mode: 'toBe',
    });
    if (data === null) throw new Error('no moment');
    const { container } = render(<Experience base={base} data={data} mode="toBe" model={model} />);
    expect(container.querySelector('svg')).not.toBeNull();
    expect(screen.getByRole('button', { name: /Trace the system work/ }).dataset.step).toBe('2');
    const next = screen.getByText('Next in the recorded flow').closest('button');
    expect(next?.dataset.step).toBe(String(data.next?.stop));
  });

  it('lists the system steps with the current one marked and the failure folded', () => {
    render(<Experience base={base} data={dataAt(0)} mode="toBe" model={model} />);
    expect(screen.getByRole('heading', { name: 'System steps' })).toBeTruthy();
    const items = screen.getAllByRole('listitem');
    expect(items[0]?.getAttribute('aria-current')).toBe('step');
    expect(screen.getAllByText('If this fails').length).toBeGreaterThan(0);
  });

  it('says the last moment is the last, and takes slots for the journey', () => {
    const last = moments.length - 1;
    render(
      <Experience
        base={base}
        comparison={<p>compared</p>}
        data={dataAt(last)}
        mode="toBe"
        model={model}
        stepper={<p>stepper</p>}
        tabMarks={moments.map((m) => (
          <em key={m.anchor}>mark</em>
        ))}
      />,
    );
    expect(screen.getByText('Last recorded screen.')).toBeTruthy();
    expect(screen.getByText('compared')).toBeTruthy();
    expect(screen.getByText('stepper')).toBeTruthy();
    expect(screen.getAllByText('mark')).toHaveLength(moments.length);
  });
});

describe('LinkedScreenBlock and SystemStepper', () => {
  it('names the linked screen, or says it is unavailable', () => {
    const { rerender, container } = render(
      <LinkedScreenBlock
        base={base}
        mode="toBe"
        model={model}
        screen={{ id: 'scr:pdp', label: 'Product page', focus: [], present: true }}
      />,
    );
    expect(screen.getByText('Product page')).toBeTruthy();
    expect(container.querySelector('svg')).not.toBeNull();
    rerender(
      <LinkedScreenBlock
        base={base}
        mode="toBe"
        model={model}
        screen={{ id: 'scr:pdp', label: 'Product page', focus: [], present: false }}
      />,
    );
    expect(screen.getByText('Screen details are unavailable.')).toBeTruthy();
    rerender(<LinkedScreenBlock base={base} mode="toBe" model={model} screen={null} />);
    expect(container.textContent).toBe('');
  });

  it('steps back and forward by stop, and is empty with nowhere to go', () => {
    const moment = moments[0];
    if (moment === undefined) throw new Error('no moment');
    const { prev, next } = systemNav({ ...moment, indices: [0, 1, 2] }, stops, 1);
    const { container, rerender } = render(<SystemStepper next={next} prev={prev} />);
    expect(screen.getByRole('button', { name: /Previous system step/ }).dataset.step).toBe('1');
    expect(screen.getByRole('button', { name: /Next system step/ }).dataset.step).toBe('3');
    rerender(<SystemStepper next={null} prev={null} />);
    expect(container.textContent).toBe('');
  });
});
