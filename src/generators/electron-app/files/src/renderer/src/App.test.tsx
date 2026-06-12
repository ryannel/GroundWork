import { beforeEach, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import type { CoreHealth, RendererApi } from '../../shared/ipc';

// The bridge is faked at the window seam — exactly the surface a sandboxed
// renderer sees, so the test proves the component against the same contract
// the preload script implements. Deeper component-testing idiom is the web
// stack's, unchanged (the groundwork-nextjs-engineer skill's testing
// reference).

function fakeApi(coreHealth: CoreHealth): RendererApi {
  return {
    getStatus: async () => ({ status: 'ok', version: '0.1.0-test', platform: 'test' }),
    getCoreHealth: async () => coreHealth,
    openExternal: async () => ({ opened: false }),
    onThemeChanged: () => () => undefined,
  };
}

function renderApp(): void {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <App />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  Object.defineProperty(window, 'api', {
    value: fakeApi({ reachable: true, status: 'ok' }),
    configurable: true,
  });
});

it('renders the IPC-backed status', async () => {
  renderApp();
  // findByText retries until the query resolves past the pending state.
  expect(
    await screen.findByText(/desktop shell — status ok/),
  ).toBeInTheDocument();
});

it('renders the workspace core wiring proof', async () => {
  renderApp();
  expect(
    await screen.findByText(/Wired to the workspace core — status ok/),
  ).toBeInTheDocument();
});

it('renders an unreachable core as a state, not a crash', async () => {
  Object.defineProperty(window, 'api', {
    value: fakeApi({ reachable: false, status: 'unreachable' }),
    configurable: true,
  });
  renderApp();
  expect(
    await screen.findByText(/Workspace core unreachable/),
  ).toBeInTheDocument();
});
