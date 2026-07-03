# Version Corrections

Where the model's training data is stale. This file is a checklist, not a tutorial — each item names what changed, why it bites, and the minimal fix. Verify against `package.json` before applying; a project pinned to an older Node may not carry all of these yet.

## `fetch` is built in (Node 18+)

Global `fetch`, `Request`, `Response`, `Headers`, and `FormData` ship with Node (via undici), and `AbortSignal.timeout` covers request deadlines. Reaching for `node-fetch` or `axios` as the default HTTP client is stale training data — add a client library only for a capability the built-in lacks (proxies, connection tuning → undici itself).

## `--env-file` and `import.meta.dirname` (Node 20.6 / 20.11+)

`node --env-file=.env` loads env files natively, so `dotenv` is a stale dependency. `import.meta.dirname` and `import.meta.filename` replace the `fileURLToPath(import.meta.url)` dance; `__dirname` does not exist in ESM, and training data keeps reaching for both old forms.

## `require(esm)` landed (Node 22)

CommonJS can `require()` a synchronous ESM graph (on by default from 22.12). The dual-package advice from older training data — shipping parallel CJS+ESM builds behind conditional `exports` to dodge the dual-package hazard — is mostly obsolete. Ship ESM only.

## `node:test` exists; this workspace standardises on Vitest

The built-in test runner is stable and training data increasingly suggests it. The suite standard here is Vitest with Testcontainers (`testing.md`); do not scaffold `node:test` suites beside it — one runner per repo.

## Promise fs and `node:` prefixes

Callback-style `fs.readFile(path, cb)` and bare `require("fs")` are old idiom: import from `node:fs/promises`, and prefix every builtin with `node:` so a builtin can never be shadowed by an npm package.
