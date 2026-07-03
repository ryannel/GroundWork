# A Pure Core, Swappable Edges (Node/TypeScript)

## Dependency Rule

Dependencies flow inward. The core never imports from the edge. dependency-cruiser makes this a real gate: a rule set in `.dependency-cruiser.cjs` forbids `src/core` from importing `src/adapters`, `src/entrypoints`, or any framework/driver package, and the check runs as part of lint — a core → adapter import fails the build, not a review comment.

```js
// .dependency-cruiser.cjs — the enforced boundary
module.exports = {
  forbidden: [
    {
      name: "core-imports-nothing-from-the-edge",
      severity: "error",
      from: { path: "^src/core" },
      to: { path: "^src/(adapters|entrypoints)" },
    },
    {
      name: "core-is-framework-free",
      severity: "error",
      from: { path: "^src/core" },
      to: { path: "node_modules/(fastify|drizzle-orm|pg|pino)" },
    },
  ],
};
```

## Where code lives

Paths relative to the service root:

| Zone | Location | Depends on | Contains |
|---|---|---|---|
| **Domain** | `src/core/domain/` | Nothing (stdlib + zod only) | Entities, value objects, domain error classes, constants |
| **Ports** | `src/core/ports.ts` (+ per-capability modules) | Domain only | TypeScript interfaces describing the capabilities the core consumes |
| **Services** | `src/core/service/` | Domain + Ports | Use-case orchestration, workflow coordination |
| **Adapters** | `src/adapters/` | Domain + Ports | Concrete implementations (Postgres via Drizzle, external APIs, queues) |
| **Entrypoints** | `src/entrypoints/` | Domain + Services | Fastify routes, CLI, queue consumers, the composition root |

## Structural Invariants

- The Domain imports no framework, no SDK, no database driver, no HTTP client. Zod and stdlib only.
- Ports define _what_ (`store`, `publish`), never _how_. Signatures use Domain types exclusively.
- Ports use domain names: `publish(msg: Message)`, not `sendToSqs(msg: Message)`.
- Services depend on ports (interfaces), not concrete adapters. Return concrete Domain objects.
- Adapters map SDK responses into Domain types. Catch library-specific errors and throw Domain errors with `cause`.
- Entrypoints validate inputs, map request schemas to Domain objects, and delegate all business decisions to Services.
- All concrete adapter-to-service wiring happens at the composition root.

## The Composition Root

One module at the entrypoint (`src/entrypoints/server.ts` or a dedicated `wiring.ts`) constructs every adapter, injects them into services typed as ports, and registers routes. No DI container or decorator framework — explicit constructor wiring keeps every dependency visible at compile time and makes cycles impossible by construction.

Fastify plugin encapsulation scopes routes, hooks, and decorators; it is not a substitute for the composition root. A plugin that constructs its own adapters hides wiring the root should own — plugins receive already-wired services as options.

## Integrity Testing

- **Bootstrap verification.** A system test constructs the full dependency tree through the real composition root. Catches missing config and wiring failures before production.
- **Golden path.** One test per critical journey against real infrastructure via Testcontainers, zero mocks.

## Anti-Patterns

- **Framework-coupled domain.** If the core imports Fastify or Drizzle, it is broken.
- **Leaky ports.** A port with an SDK or driver type in its signature is an adapter in disguise.
- **DI containers.** Inversify/Nest-style decorator injection hides the wiring the composition root exists to show.
- **Plugin-as-architecture.** Encapsulating adapters inside Fastify plugins scatters the composition root across the route tree.
- **Layer-skipping.** Entrypoints talking directly to adapters.
- **Over-layering.** Five layers of DTO translation. Adapters are thin.
