// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { currentTab, PathTabs } from './path-tabs.client';

vi.mock('next/navigation', () => ({ usePathname: () => '/w/d/flows/one' }));

afterEach(cleanup);

const tabs = [
  { href: '/w/d/', label: 'Overview' },
  { href: '/w/d/flows/', label: 'Flows', count: 4 },
  { href: '/w/d/map/', label: 'Map' },
];

describe('currentTab', () => {
  it('picks the tab with the longest address the page sits under', () => {
    expect(currentTab(tabs, '/w/d/')).toBe('/w/d/');
    expect(currentTab(tabs, '/w/d/map')).toBe('/w/d/map/');
    expect(currentTab(tabs, '/w/d/flows/one/')).toBe('/w/d/flows/');
    expect(currentTab(tabs, '/elsewhere/')).toBe('/w/d/');
    expect(currentTab([], '/w/')).toBe('');
  });
});

describe('PathTabs', () => {
  it('marks the open tab from the address and shows its count', () => {
    render(<PathTabs label="Ways to read" tabs={tabs} />);
    const current = screen.getByRole('link', { current: 'page' });
    expect(current.textContent).toBe('Flows4');
  });
});
