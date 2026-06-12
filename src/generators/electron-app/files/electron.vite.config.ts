import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// One config, three build targets — main and preload compile against the Node
// context, the renderer is a normal Vite + React web app. Tailwind v4 loads as
// a Vite plugin in the renderer section ONLY: it never applies to main or
// preload (docs/principles/stack/electron/packaging-and-updates.md).
export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: { entry: 'src/main/index.ts' },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: { entry: 'src/preload/index.ts' },
    },
  },
  renderer: {
    root: 'src/renderer',
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        input: 'src/renderer/index.html',
      },
    },
  },
});
