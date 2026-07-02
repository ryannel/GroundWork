# IPC Contracts

## The Seam Is a Contract

The main↔renderer seam gets the same discipline the capability core enforces at its contracts. One module — `src/shared/ipc.ts` — declares every channel; both sides import it; a rename or payload change is a compile error in both processes.

```ts
// src/shared/ipc.ts (types only)
export type IpcContract = {
  'app:get-status': { args: []; result: AppStatus };
  'shell:open-external': { args: [url: string]; result: OpenExternalResult };
};
```

Channel naming: `domain:verb` (`project:open`, `settings:get`, `theme:changed`). The bridge methods name **capabilities** (`getStatus`, `openExternal`), never transport (`invoke`, `send`).

`invoke`/`handle` is the two-way pattern — promise-based, errors propagate to the caller. `send`/`on` carries one-way pushes from main. `sendSync` is forbidden: it blocks the renderer event loop for the round trip.

## Adding a Channel End-to-End

Four pieces, in this order. A channel missing any of them is incomplete.

**1. Contract type** (`src/shared/ipc.ts`):

```ts
export type ProjectSummary = { path: string; fileCount: number };

export type IpcContract = {
  // ...existing channels
  'project:open': { args: [path: string]; result: ProjectSummary };
};

export type RendererApi = {
  // ...existing methods
  openProject: (path: string) => Promise<ProjectSummary>;
};
```

**2. Validated handler** (`src/main/ipc.ts`):

```ts
const openProjectPayload = z.string().min(1);

ipcMain.handle('project:open', async (event, rawPath: unknown): Promise<ProjectSummary> => {
  assertTrustedSender(event, devServerUrl);          // every handler
  const projectPath = openProjectPayload.parse(rawPath); // non-trivial payloads
  return openProject(projectPath);                   // delegate; main orchestrates
});
```

**3. Bridge method** (`src/preload/index.ts`):

```ts
const api: RendererApi = {
  // ...existing methods
  openProject: (path) => ipcRenderer.invoke('project:open', path),
};
```

**4. Renderer consumption** — through the cache layer, never a bare effect:

```ts
const { data } = useQuery({
  queryKey: ['project', path],
  queryFn: () => window.api.openProject(path),
});
```

Typing keeps the pieces honest: `RendererApi` is implemented by preload and consumed via the `Window` augmentation in `src/renderer/src/env.d.ts`, so a drifted signature fails both tsconfigs.

## Validation at the Trust Boundary

Main treats renderer input as untrusted, the same way an API treats the public internet. Two checks in every handler:

- **Sender validation, always.** `assertTrustedSender` verifies `event.senderFrame.url` against the bundle protocol / dev-server origin (security checklist item 17). A destroyed or missing frame is rejected. This is what stops an iframe or a navigated-away window from driving privileged code.
- **Payload validation with zod for anything beyond a trivial getter.** TypeScript types vanish at runtime; a compromised renderer is not bound by them. `z.string().url()`, `z.object({...}).strict()` — parse, don't trust. A handler taking no arguments (like `app:get-status`) needs only the sender check.

Failures throw — `invoke` rejects in the renderer, which is correct: a rejected privileged call is a bug or an attack, not a state to paper over.

## Push Channels (Main → Renderer)

One-way events (theme changes, update progress, file-watcher hits) flow as `webContents.send` from main to a **subscription method on the bridge** that returns an unsubscribe function:

```ts
// preload
onThemeChanged: (callback) => {
  const listener = (_e: Electron.IpcRendererEvent, theme: ThemeInfo) => callback(theme);
  ipcRenderer.on('theme:changed', listener);
  return () => ipcRenderer.removeListener('theme:changed', listener);
},
```

Declare push channels in `IpcPushContract` so they are part of the contract too. The renderer never receives the event object — only the typed payload. Theme is the canonical example: `nativeTheme` in main, broadcast on `updated`, mirrored onto `<html data-theme>` (`references/theming-and-tokens.md`).

## TanStack Query Over the Bridge

The renderer's data source is IPC, not HTTP, and TanStack Query is the convergent IPC-aware pattern: `queryFn`s call the typed bridge; caching, retry, and invalidation work exactly as in an HTTP app. This is the desktop shell's one deviation from the web stack's SWR pick — the one-cache-one-mental-model rule still holds: **TanStack Query is the renderer's only query library.**

Push events invalidate queries through a bridge subscription:

```ts
useEffect(() => {
  return window.api.onProjectChanged(() => {
    void queryClient.invalidateQueries({ queryKey: ['project'] });
  });
}, [queryClient]);
```

(The effect here manages a subscription — that is its legitimate use. *Fetching* in an effect is still wrong; see the web stack's data-fetching reference for the full discipline.)

## Core Access for a Hosted Capability Core

When the workspace has a hosted core (services behind promoted contracts), the desktop app reaches it from **main's side of the seam**: main holds the HTTP client, tokens, and retries; the renderer asks main over IPC. This keeps credentials out of the sandboxed process, keeps the strict CSP intact (`default-src 'self'` — the renderer fetches nothing), and gives core calls the same sender/payload validation as every other channel. Do not punch `connect-src` holes in the CSP to let the renderer fetch the gateway directly.

## The electron-trpc Variant

tRPC-over-IPC (Zod inputs, queries/mutations/subscriptions, React Query integration) is the packaged version of this pattern — and a **recorded choice, not the default**: it sits in a maintenance lull (tRPC v11 support lives in forks) and adds per-call overhead on hot paths. The hand-rolled contract above covers the same ground with no dependency risk. Adopt electron-trpc only via a decision record naming what outgrew the hand-rolled seam.

## Anti-Patterns

- **Exposing `ipcRenderer`, a whole Electron module, or a generic `invoke(channel, ...args)` passthrough on `window`.** All three make the narrow bridge infinitely wide.
- **`sendSync`.** Always an async shape instead.
- **String-typed ad-hoc channels** with no entry in the shared contract.
- **Trusting renderer payloads or senders** because "the types guarantee it" — they don't, at runtime.
- **The `remote` module** or packages emulating it.
- **Raw `useEffect` IPC fetching.** Data goes through TanStack Query; effects only manage subscriptions.
