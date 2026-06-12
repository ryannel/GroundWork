import { beforeEach, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import type { RendererApi } from '../../shared/ipc';

// The bridge is faked at the window seam — exactly the surface a sandboxed
// renderer sees, so the test proves the component against the same contract
// the preload script implements. Deeper component-testing idiom is the web
// stack's, unchanged (the groundwork-nextjs-engineer skill's testing
// reference).

const fakeApi: RendererApi = {
  getStatus: async () => ({ status: 'ok', version: '0.1.0-test', platform: 'test' }),
  openExternal: async () => ({ opened: false }),
  onThemeChanged: () => () => undefined,
};

beforeEach(() => {
  Object.defineProperty(window, 'api', { value: fakeApi, configurable: true });
});

it('renders the IPC-backed status', async () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <App />
    </QueryClientProvider>,
  );
  // findByText retries until the query resolves past the pending state.
  expect(await screen.findByText(/status ok/)).toBeInTheDocument();
});
