// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { accountPlan } from '@/../test/screens-kit';
import { derive } from '@/application/plan/derive';

import { BeforeAfter } from './before-after';
import { JourneyStrip } from './journey-strip';
import { ProposedTag } from './proposed-tag';
import { RegionList } from './region-list';
import { ScreenCard } from './screen-card';
import { ScreenFigure } from './screen-figure';
import { ScreenLinks } from './screen-links';

vi.mock(import('server-only'), () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');

const base = '/plans/x/';
const account = derive(accountPlan());
const shop = derive(await loadFixture('shop.yaml'));

afterEach(cleanup);

const numbersIn = (root: ParentNode) =>
  [...root.querySelectorAll<HTMLElement>('[data-inspect^="scr:account#"]')].map((el) => ({
    id: el.dataset.inspect ?? '',
    text: el.textContent,
  }));

describe('ScreenFigure', () => {
  it('outlines each region, numbered and coloured by status', () => {
    const { container } = render(
      <ScreenFigure
        base={base}
        caption={false}
        id="scr:account"
        mode="toBe"
        model={account}
        status
      />,
    );
    const regions = [...container.querySelectorAll<HTMLElement>('button[data-inspect]')];
    expect(regions.map((r) => r.dataset.inspect)).toEqual([
      'scr:account#plan',
      'scr:account#pause',
    ]);
    expect(regions.map((r) => r.dataset.status)).toEqual(['modified', 'added']);
    expect(container.querySelector('img')?.getAttribute('src')).toContain('account-tobe.svg');
  });

  it('ghosts a region the plan removes and strikes its number', () => {
    const { container } = render(
      <ScreenFigure
        base={base}
        id="scr:account"
        mode="toBe"
        model={account}
        status
        ghosts={[
          {
            id: 'scr:account#cancel',
            name: 'Cancel',
            number: 3,
            gone: true,
            at: { x: 10, y: 50, w: 80, h: 10 },
          } as never,
        ]}
      />,
    );
    expect(container.querySelector('[title="Cancel · goes away"]')).not.toBeNull();
  });

  it('says there is no picture yet when the screen has none', () => {
    render(
      <ScreenFigure
        base={base}
        id="scr:account"
        mode="toBe"
        model={derive(accountPlan({ toBeImage: '' }))}
      />,
    );
    expect(screen.queryByText('No picture yet')).toBeNull();
  });

  it('puts a caption and a link on the name when asked', () => {
    render(<ScreenFigure base={base} caption id="scr:account" link model={account} />);
    expect(screen.getByText('Account')).toBeTruthy();
  });

  it('draws nothing for something that is not a screen', () => {
    const { container } = render(<ScreenFigure base={base} id="svc:web" model={account} />);
    expect(container.textContent).toBe('');
  });
});

describe('RegionList', () => {
  it('numbers the regions as the picture does', () => {
    const list = render(
      <RegionList id="scr:account" mode="toBe" model={account} numbered status />,
    );
    const picture = render(
      <ScreenFigure base={base} id="scr:account" mode="toBe" model={account} status />,
    );
    const inList = numbersIn(list.container).map((r) => r.id);
    expect(inList.length).toBeGreaterThan(0);
    for (const id of inList) {
      expect(picture.container.querySelector(`[data-inspect="${id}"]`)).not.toBeNull();
    }
  });

  it('lists a removed region as going', () => {
    const { container } = render(
      <RegionList id="scr:account" mode="toBe" model={account} status />,
    );
    expect(container.textContent).toContain('Cancel');
  });
});

describe('BeforeAfter', () => {
  it('offers a swipe only once both pictures are known to be the same shape', () => {
    const { container } = render(<BeforeAfter base={base} id="scr:account" model={account} />);
    expect(screen.queryByRole('radiogroup')).toBeNull();
    const imgs = [...container.querySelectorAll('img')];
    expect(imgs.length).toBeGreaterThanOrEqual(2);
    for (const img of imgs) {
      Object.defineProperty(img, 'naturalWidth', { value: 400, configurable: true });
      Object.defineProperty(img, 'naturalHeight', { value: 300, configurable: true });
      fireEvent.load(img);
    }
    expect(screen.getByRole('radiogroup')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'Swipe' }));
    expect(container.querySelector('[data-view="swipe"]')).not.toBeNull();
  });

  it('stays side by side for pictures of different shapes', () => {
    const { container } = render(<BeforeAfter base={base} id="scr:account" model={account} />);
    const [a, b] = [...container.querySelectorAll('img')];
    if (!a || !b) throw new Error('two pictures expected');
    Object.defineProperty(a, 'naturalWidth', { value: 400, configurable: true });
    Object.defineProperty(a, 'naturalHeight', { value: 300, configurable: true });
    Object.defineProperty(b, 'naturalWidth', { value: 100, configurable: true });
    Object.defineProperty(b, 'naturalHeight', { value: 600, configurable: true });
    fireEvent.load(a);
    fireEvent.load(b);
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });

  it('draws nothing for a screen the plan does not touch', () => {
    const { container } = render(<BeforeAfter base={base} id="svc:web" model={account} />);
    expect(container.textContent).toBe('');
  });
});

describe('ScreenLinks', () => {
  it('draws nothing when there are no links', () => {
    const { container } = render(<ScreenLinks base={base} id="scr:account" model={account} />);
    expect(container.querySelectorAll('a')).toHaveLength(0);
  });
});

describe('ProposedTag', () => {
  it('draws nothing without marks', () => {
    const { container } = render(<ProposedTag id="scr:account" marks={null} />);
    expect(container.textContent).toBe('');
  });

  it('names the revision that proposes the element', () => {
    const { container } = render(
      <ProposedTag
        id="scr:account"
        marks={{ version: '1.2', base: '1.1', marks: new Map([['scr:account', 'new']]) }}
      />,
    );
    expect(container.textContent).toBe('new');
  });
});

describe('ScreenCard', () => {
  it('is a card for a screen of the plan', () => {
    const { container } = render(<ScreenCard base={base} id="scr:account" model={account} />);
    expect(container.textContent).toContain('Account');
  });
});

describe('JourneyStrip', () => {
  it('draws nothing for a flow that touches no screens', () => {
    const { container } = render(
      <JourneyStrip base={base} flowId="flow:price-purge" model={shop} />,
    );
    expect(container.textContent).toBe('');
  });

  it('opens the screen when no stepper is listening', () => {
    render(<JourneyStrip base={base} flowId="flow:browse" mode="toBe" model={shop} />);
    expect(screen.getByRole('navigation', { name: 'Screen journey' })).toBeTruthy();
    expect(document.querySelector('button[data-inspect="scr:pdp"]')).not.toBeNull();
  });

  it('reports the stop a leg stands for', () => {
    const onGoto = vi.fn<(stop: number) => void>();
    render(
      <JourneyStrip
        base={base}
        flowId="flow:browse"
        mode="toBe"
        model={shop}
        onGoto={onGoto}
        stops={[{ stepIds: ['flow:browse#open'], indices: [0] }]}
      />,
    );
    fireEvent.click(screen.getByTitle(/go to this step/u));
    expect(onGoto).toHaveBeenCalledWith(0);
  });
});
