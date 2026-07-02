# Process Model

## The Three Processes

| Process | Runs | May import | Job |
|---|---|---|---|
| **main** (`src/main/`) | Node + Electron main APIs | anything | Orchestration: windows, security policy, IPC handlers, OS integration |
| **preload** (`src/preload/`) | sandboxed bridge context | `electron` (bridge subset) + shared types | Expose the narrow `window.api`; nothing else |
| **renderer** (`src/renderer/`) | Chromium, sandboxed, Node-free | web code + shared types | The UI — a normal Vite + React web app |

`src/shared/` is not a process: it is the contract-type module all three import (types only — see below).

This is the VS Code / Slack / Signal shape. It exists because a renderer with Node access turns any XSS into machine compromise, and a busy main process freezes every window at once.

## Main Is an Orchestrator

`src/main/index.ts` does four things: registers the bundle protocol, applies the security policy, registers IPC handlers, creates windows. Everything else is delegation.

The test for new main-process code: **can this take longer than a frame?** Parsing a large file, hashing, indexing, image work — yes, so it goes to a `utilityProcess`. Reading a config file, showing a dialog, registering a handler — no, main is fine.

Keep main's modules pure where possible: `src/main/policy.ts` holds the security rules with **no Electron imports**, which is why `policy.test.ts` runs in plain Node. When adding privileged logic, split it the same way — decision (pure module, unit-tested) from wiring (thin Electron glue in `index.ts`/`ipc.ts`).

## The Enforced Folder Boundary

```
src/
  main/      # privileged orchestration
  preload/   # the bridge — contextBridge only
  renderer/  # the web app — no Node, no Electron
  shared/    # IPC contract types — types only
```

The split is physical and lint-enforced (the Slack pattern): `eslint.config.mjs` carries `no-restricted-imports` blocks that fail the build when `src/renderer/` or `src/shared/` imports `electron` or a Node built-in. The rule exists because the boundary erodes one convenient import at a time, and each erosion is invisible until it is a sandbox hole.

Never suppress the rule. If the renderer "needs" a Node capability, that is a new IPC channel (`references/ipc-contracts.md`), not an exemption.

## Per-Process Compiler Contexts

Two tsconfigs police the boundary alongside the lint:

- `tsconfig.node.json` — main, preload, shared, configs, smoke tests. `types: ["node"]`, **no DOM lib**.
- `tsconfig.web.json` — renderer + shared. DOM lib, `jsx: react-jsx`, **no Node types**.

`npm run typecheck` (the `typecheck` Nx target) runs both. A renderer file that touches `process` or a main file that touches `document` is a compile error, not a code-review catch. When adding files, make sure they land in the right include set — a file checked by neither tsconfig is unverified code.

## utilityProcess for Heavy Work

`utilityProcess` is the documented home for CPU-intensive tasks, untrusted services, and crash-prone components — a `child_process.fork` equivalent launched through Chromium's Services API, with Node enabled and MessagePort support.

The pattern (VS Code's extension host is the reference):

```ts
// main: spawn and wire ports renderer↔utility DIRECTLY
import { utilityProcess, MessageChannelMain } from 'electron';

const worker = utilityProcess.fork(
  new URL('./indexer.js?modulePath', import.meta.url).pathname,
);
const { port1, port2 } = new MessageChannelMain();
worker.postMessage({ type: 'port' }, [port1]);
window.webContents.postMessage('indexer:port', null, [port2]);
```

The direct port wiring matters: heavy traffic never transits — or blocks — main. electron-vite builds utility workers first-class via the `?modulePath` import suffix.

Use `utilityProcess`, not `child_process.fork`, for anything that talks to a renderer: fork has no port wiring and no Services API integration. Plugin-style or untrusted code never runs in the renderer — a utility process contains its crash or compromise.

## Shared Code Crosses as Types Only

`src/shared/ipc.ts` carries the channel map and payload types both sides import. It must contain **no runtime behaviour** — a "utils" module imported by main and renderer drags Node-flavoured code toward the sandbox and couples both sides' upgrade paths. The lint boundary enforces the import side; review enforces the no-runtime side: if a shared file gains a function body that does more than type-level work, move it.

Constants are the one nuance: a string-literal channel name in the contract type is fine; a shared object of behaviourful helpers is not.

## Adding a Window

Every window — main, settings, about, anything — gets the identical hardened construction:

1. Build it in `src/main/index.ts` (or a sibling module main imports) with the full `webPreferences` quartet and the shared preload.
2. Load content only from the bundle protocol or the dev server; never a remote URL, never `file://`.
3. The global policy (`applySecurityPolicy`) already covers it — permission denial and navigation restriction hook `web-contents-created`, so they apply to new windows automatically. Do not bypass that path with per-window overrides.
4. If the window needs new capabilities, they arrive as IPC channels, not as loosened `webPreferences`.

A second renderer entry point goes in `electron.vite.config.ts`'s renderer `rollupOptions.input` map, with its own HTML file carrying the same CSP.
