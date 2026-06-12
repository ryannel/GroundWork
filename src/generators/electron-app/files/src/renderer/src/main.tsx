import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './assets/main.css';

// nativeTheme (main process) is the source of truth for dark mode: main
// broadcasts changes over the bridge and the renderer mirrors them onto
// <html data-theme>, which brand.css resolves into per-theme token values
// (docs/principles/stack/electron/ipc-contracts.md).
window.api.onThemeChanged((theme) => {
  document.documentElement.dataset.theme = theme.shouldUseDarkColors
    ? 'dark'
    : 'light';
});

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
