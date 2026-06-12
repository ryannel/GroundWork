---
title: IPC Contracts
description: The typed bridge, invoke/handle, runtime validation at the process seam, and IPC-aware data fetching in the renderer.
status: active
last_reviewed: 2026-06-12
---
# IPC Contracts

## TL;DR

The main↔renderer seam is a contract boundary and gets the same discipline the capability core enforces at its contracts: a narrow, purpose-named bridge; `invoke`/`handle` for two-way calls; one shared TypeScript contract type both sides consume; runtime validation in main because renderer input is untrusted. `ipcRenderer` is never exposed and `sendSync` is forbidden.

## Why this matters

IPC is where the privileged process meets the sandboxed one. A wide or untyped bridge re-creates the Node-enabled renderer one channel at a time, and an unvalidated handler lets a compromised renderer drive privileged code with arbitrary payloads. Treating the seam as a typed, validated contract keeps the sandbox meaningful — and gives the agent a single place to read what the shell can do.

## Our principles

### 1. The bridge is narrow and purpose-named

Preload exposes a small API object via `contextBridge.exposeInMainWorld()` whose methods name capabilities, not transport:

```ts
// src/preload/index.ts
contextBridge.exposeInMainWorld('api', {
  openProject: (path: string) => ipcRenderer.invoke('project:open', path),
  onThemeChanged: (cb: (theme: Theme) => void) => {
    ipcRenderer.on('theme:changed', (_e, theme) => cb(theme));
  },
});
```

`ipcRenderer` itself — or any whole Electron module — is never put on `window`; the official docs forbid it for security reasons, because a raw `ipcRenderer` lets injected code call every channel the app has.

### 2. `invoke`/`handle` for two-way, `send`/`on` for one-way

`ipcRenderer.invoke` / `ipcMain.handle` is the request/response pattern — promise-based, with errors propagating to the caller. `send`/`on` carries one-way pushes from main (theme changes, update events, file-watcher notifications). `sendSync` is forbidden: it blocks the renderer's event loop for the round trip.

### 3. One shared contract type, consumed by both sides

A channel-name → request/response signature map lives in `src/shared/` and types a thin wrapper on each side, so a channel rename or payload change is a compile error in both processes:

```ts
// src/shared/ipc.ts
export type IpcContract = {
  'project:open': { args: [path: string]; result: ProjectSummary };
  'settings:get': { args: []; result: Settings };
};
```

This is the hand-rolled convergent pattern. **electron-trpc** (tRPC over IPC, Zod inputs, subscriptions) is the documented variant for apps that want a full RPC layer — but it sits in a maintenance lull (last release 2024-12-07; tRPC v11 support lives in forks) and adds per-call overhead on hot paths, so it is a recorded choice, not the default.

### 4. Main validates everything it receives

Main treats renderer input as untrusted, the same way an API treats the public internet. Two checks in every non-trivial `ipcMain.handle`:

- **Payload validation** with zod for anything beyond a trivial getter — the TypeScript types vanish at runtime, and a compromised renderer is not bound by them.
- **Sender validation** via `event.senderFrame` (security checklist item 17) — verify the call comes from your app's frame, not an iframe or a navigated-away window.

### 5. Renderer data fetching is TanStack Query over the bridge

The renderer's data source is IPC, not HTTP, and TanStack Query is the convergent IPC-aware pattern: `queryFn`s call the typed bridge (`window.api.foo()`), and main-process push events arrive through a bridge subscription that invalidates queries. Caching, retry, and invalidation work exactly as in an HTTP app. This is the desktop shell's one deviation from the web stack's SWR pick in [TypeScript Frontend](../typescript/frontend.md) — the one-cache-one-mental-model rule there still holds: TanStack Query is the renderer's only query library. Theme is the canonical push example: `nativeTheme` in main, broadcast over `send`, mapped to an attribute on `<html>`; everything about what the theme contains defers to [TypeScript Frontend](../typescript/frontend.md).

## Anti-patterns we reject

- **Exposing `ipcRenderer` or Electron modules on `window`.** The bridge exists to be narrow; this makes it infinitely wide.
- **`sendSync`.** It blocks the renderer event loop. There is always an async shape.
- **String-typed ad-hoc channels.** A channel with no entry in the shared contract is an untyped seam that drifts silently.
- **Trusting renderer payloads or senders in main.** Compile-time types are not runtime guarantees.
- **The `remote` module.** Removed from core; any dependency resurrecting it is a finding.
- **Raw `useEffect` IPC fetching in React.** Same rule as the web stack: data goes through the cache layer, not effect spaghetti.
