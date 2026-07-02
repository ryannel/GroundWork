# Node Service Standards

Node/TypeScript code here is boring on purpose: native ESM on a current LTS, strict TypeScript, boundaries parsed with zod, errors as a designed hierarchy, and every service a pure core wrapped by swappable edges — the inward-dependency rule written the Node way.

## Principles

### 1. Native ESM, `node:` builtins

`"type": "module"` in `package.json`; no transpile-to-CJS pipeline. Import builtins with the `node:` prefix (`node:fs/promises`, `node:crypto`) so a builtin can never be shadowed by an npm package. Ship one module format: ESM (see `version-corrections.md` for why dual-package builds are obsolete).

### 2. Strict TypeScript is the floor

`"strict": true` plus `noUncheckedIndexedAccess`. External data enters as `unknown` and is parsed with zod — an `as` cast on external data asserts a shape nobody checked, and an `any` at the edge silently turns every downstream type into a guess.

### 3. Configuration is parsed once at startup

One zod schema over `process.env`, parsed in the composition root before the server accepts traffic — a missing or malformed variable crashes the boot with every offending key named, instead of a 3 a.m. `undefined` deep in a handler.

```ts
// src/entrypoints/config.ts
import { z } from "zod";

const ConfigSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().default(8080),
  WEBHOOK_SECRET: z.string().min(16),
  CORS_ALLOWED_ORIGINS: z.string().transform((s) => s.split(",")),
});
export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(env = process.env): Config {
  return ConfigSchema.parse(env); // throws before traffic, naming every bad key
}
```

Downstream code receives `Config` (or a slice of it) by injection. A `process.env` read outside this module is a defect.

### 4. Errors are a designed hierarchy

Domain error classes extend one base, are defined where callers branch on them, and carry the original failure as `cause` so the taxonomy stays domain-shaped while the stack stays diagnosable.

```ts
export class AppError extends Error {
  constructor(message: string, readonly code: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}
export class NotFoundError extends AppError {}
export class TransientUpstreamError extends AppError {}
```

Wrap at the adapter boundary: catch the driver or SDK error, throw the domain error with `{ cause: err }`. Map to HTTP once, at the entrypoint's error handler (`api-standards.md`). Never throw strings or bare objects — they have no stack and no `instanceof`.

### 5. AbortSignal is threaded everywhere

Every function that does I/O accepts an `AbortSignal`, so a caller's deadline or cancellation reaches the wire instead of leaving orphaned work running. Compose deadlines with `AbortSignal.timeout` and `AbortSignal.any`:

```ts
async fetchQuote(sku: string, signal: AbortSignal): Promise<Quote> {
  const res = await fetch(this.url(sku), {
    signal: AbortSignal.any([signal, AbortSignal.timeout(5_000)]),
  });
  ...
}
```

Every outbound call has a timeout; no exceptions. Retry only errors mapped as transient, bounded and jittered, at one layer of the stack — the retry doctrine is `docs/principles/quality/reliability.md`.

### 6. Graceful shutdown is a sequence, not an exit

On SIGTERM: stop accepting, drain in-flight, sever long-lived, close pools — in that order, under a hard deadline. Register it once, at the composition root.

```ts
process.once("SIGTERM", async () => {
  const deadline = setTimeout(() => process.exit(1), 10_000);
  deadline.unref();
  await app.close();      // stop accepting; Fastify waits for in-flight replies
  await jobs.drain();     // background work the process owns (outbox relay, queues)
  sockets.closeAll(1001); // sever long-lived connections with a going-away signal
  await pool.end();       // pools last — everything above may still need them
});
```

`process.exit()` anywhere else in service code is a defect: it truncates in-flight requests and unflushed telemetry.

## Anti-Patterns

- **`any` or `as` at a boundary.** Parse with zod; the type must be earned, not asserted.
- **Scattered `process.env` reads.** One schema, one parse, injected config.
- **Throwing strings.** No stack, no `instanceof`, no `cause`.
- **`process.exit` in service code.** Only the shutdown deadline may call it.
- **dotenv as a runtime dependency.** `--env-file` or platform-injected env (`version-corrections.md`).
- **Classes as namespaces.** A class with only static members is a module wearing a costume; export functions.
