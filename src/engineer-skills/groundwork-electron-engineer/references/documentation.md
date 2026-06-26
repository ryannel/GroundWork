# Documentation

## Table of Contents
- [Hierarchy](#hierarchy)
- [The Contract Type Is the Surface Documentation](#the-contract-type-is-the-surface-documentation)
- [TSDoc on the Bridge Contract](#tsdoc-on-the-bridge-contract)
- [The Process Boundary Documents Itself](#the-process-boundary-documents-itself)
- [Why-Comments on Security Policy](#why-comments-on-security-policy)
- [Inline Comments](#inline-comments)
- [A Comment Is Often a Smell](#a-comment-is-often-a-smell)
- [In-Code Markers](#in-code-markers)
- [What NOT to Document](#what-not-to-document)

---

A desktop shell has a documentation problem the web app does not: the same TypeScript runs in three processes at three privilege levels, and a reader must know which one a file belongs to before a single line makes sense. The architecture answers that in structure — the folder boundary, the shared contract, the typed bridge — so the documentation is mostly the code's shape, not prose around it.

## Hierarchy

Structure documents more reliably than comments. A comment is a promise no compiler checks, and a stale comment about *which process runs this* is worse than none — it misleads about a security boundary. Documentation priority — the foundations principle (`docs/principles/foundations/documentation.md`) written the Electron way:

1. **Types and the shared contract** — `IpcContract`/`RendererApi` in `src/shared/ipc.ts`; a drifted signature is a compile error in both processes (`references/ipc-contracts.md`).
2. **The folder boundary** — `main/`, `preload/`, `renderer/`, `shared/` declare where code runs; lint and two tsconfigs enforce it (`references/process-model.md`).
3. **Zod schemas at the trust boundary** — runtime-checked validation that documents the accepted payload and flows into errors.
4. **Test names** — a smoke or unit test named for its behaviour is executable documentation verified by CI.
5. **TSDoc on the bridge and security policy** — written only where types and structure cannot carry the intent.
6. **Inline "why" comments** — last resort for a genuinely non-obvious decision.

Levels 1–4 are verified by tooling. Levels 5–6 are human promises that drift. Minimise them.

## The Contract Type Is the Surface Documentation

`src/shared/ipc.ts` is the single document of what the renderer may ask the privileged side to do. `IpcContract` enumerates every channel; `RendererApi` is the capability surface the UI sees. Read together they are the complete, compiler-verified description of the trust boundary — no prose inventory of "available IPC calls" stays as accurate, because this one fails the build when it lies.

```ts
// src/shared/ipc.ts — the surface, documented by its types
export type RendererApi = {
  openProject: (path: string) => Promise<ProjectSummary>;
  onProjectChanged: (cb: () => void) => () => void;
};
```

The naming carries the documentation: bridge methods name **capabilities** (`openProject`), never transport (`invoke`, `send`). A method called `invoke` documents nothing about what crosses the seam (`references/ipc-contracts.md`).

## TSDoc on the Bridge Contract

Most channels are self-documenting through their contract types. Add TSDoc only where a method carries a consequence the signature cannot — a privileged side effect, a security implication, an OS interaction the caller must understand:

```ts
export type RendererApi = {
  /**
   * Opens a path in the OS file manager. Main validates it is inside an
   * allowed root before the shell call — a renderer cannot open arbitrary
   * paths. Rejects if the path escapes the sandboxed roots.
   */
  openInFileManager: (path: string) => Promise<void>;
};
```

The note documents the trust decision, not the mechanics. A plain `getStatus(): Promise<AppStatus>` needs nothing — the name and return type are the whole contract.

## The Process Boundary Documents Itself

The folder a file lives in is its most important documentation: it declares the privilege level and what the file may import (`references/process-model.md`). That boundary is physical and enforced — `no-restricted-imports` fails the build when `renderer/` or `shared/` imports `electron` or a Node built-in, and the two tsconfigs reject a renderer file touching `process` or a main file touching `document`.

This is why a comment like `// runs in the renderer, no Node here` is a smell: the folder already says it, the lint already enforces it, and the comment will outlive the file's move to another directory. Trust the structure. When a file's process is genuinely ambiguous, the fix is to move it to the right folder, not to annotate it.

`src/shared/` documents a stronger rule by what it contains: types only, no runtime behaviour. A function body in a shared file silently drags Node-flavoured code toward the sandbox — the absence of runtime code there is itself the contract (`references/process-model.md`).

## Why-Comments on Security Policy

Security configuration is the one place inline prose earns its keep, because the *reason* a setting holds is invisible in the value and dangerous to guess at. A future reader tempted to loosen a policy must find the threat model next to the line:

```ts
// sandbox + contextIsolation are non-negotiable: the renderer loads UI
// that can be XSS'd; without these, an injection reaches Node and the OS.
webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },

// CSP forbids connect-src: the renderer fetches nothing directly — core
// calls go through main over IPC, which holds the credentials.
```

Keep `src/main/policy.ts` a pure module so the rules are unit-tested rather than narrated (`references/process-model.md`). The test documents the policy's behaviour; the comment documents only the threat the test cannot express.

## Inline Comments

Inline comments explain **why**, never **what**. In a handler, the validation and delegation are visible; the comment captures the reason.

```ts
ipcMain.handle('project:open', async (event, rawPath: unknown) => {
  assertTrustedSender(event, devServerUrl); // reject navigated-away frames
  const path = openProjectPayload.parse(rawPath);
  return openProject(path);
});
```

A comment narrating the obvious is noise — the reader can see the `parse` call.

## A Comment Is Often a Smell

When you reach for a comment to explain *what* a block does, the code is asking to be refactored:

- A comment naming which process a file runs in → move it to the right folder.
- A comment explaining a generic `invoke(channel, ...)` passthrough → name the capability; the passthrough is itself an anti-pattern (`references/ipc-contracts.md`).
- A comment decoding an untyped channel string → add it to `IpcContract`.
- A comment summarising what a handler does → the handler does too much; delegate to a named function in main.

Delete the comment and fix the code. The refactor cannot drift; the comment can.

## In-Code Markers

```ts
// TODO(bob): move indexing to a utilityProcess once payloads grow. Issue #231.
// FIXME(carol): unsubscribe leak when a window closes mid-stream. Issue #245.
// HACK(dave): re-assert CSP after a dev-only HMR reload until upstream fix.
```

Always include `(username)` and an issue reference. A marker without one will never be resolved.

## What NOT to Document

- Channels whose contract type and capability name tell the whole story.
- Which process a file runs in — the folder and the lint already say it.
- Boilerplate window construction — the hardened `webPreferences` quartet is the documented standard (`references/process-model.md`), not a per-window note.
- TanStack Query `queryFn`s that call the typed bridge — the types are the contract.
- Generated or framework code — never hand-edit comments into it.
