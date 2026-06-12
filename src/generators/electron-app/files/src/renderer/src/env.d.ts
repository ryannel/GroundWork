/// <reference types="vite/client" />

import type { RendererApi } from '../../shared/ipc';

// The renderer's ONLY platform surface: the preload-exposed bridge. It never
// imports from Electron or Node — the eslint boundary rule and the DOM-only
// tsconfig both enforce it (docs/principles/stack/electron/process-model.md).
declare global {
  interface Window {
    api: RendererApi;
  }
}

export {};
