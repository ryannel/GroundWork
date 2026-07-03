# Security

This service is a trust boundary. Everything outside it — clients, webhooks, queue events, upstream APIs, model output — is hostile until validated. This file is the Node idiom of the framework security canon (`docs/principles/quality/security.md`); when this file and the canon disagree, the canon wins and this file is the one to fix.

The controls below are enforced at the Fastify entrypoint and the adapter edge, not scattered through the Domain. The boundary is validated once and explicitly; inside it, the core trusts its own types.

## 1. Input is hostile; validate at the boundary

Every inbound payload is parsed through a zod schema at the route (`api-standards.md` wires it into Fastify) — a request that fails parsing never reaches a service. Webhook payloads, queue messages, and model outputs are boundaries too: parse before use.

```ts
const CreateOrderSchema = z.object({
  customerEmail: z.string().email(),
  quantity: z.number().int().positive().max(1000),
  note: z.string().max(2000).default(""),
}).strict(); // reject unknown fields, never silently drop
```

- `.strict()` turns mass-assignment and typo'd fields into a `422`, not a silent accept.
- Constrain at the type (`.email()`, `.int().max()`, `.max()` lengths, `z.enum`), so the constraint travels with the field and cannot be forgotten by a caller.
- Do not re-validate between internal callers — parse, don't validate: the parsed type carries its guarantee inward. One boundary, scrutinised; no defensive re-checks inside.

## 2. Parameterised queries — never string-built SQL

SQL injection is closed by construction: the query text is constant and every value is a bound parameter. Drizzle binds values, and the `sql` template turns interpolations into bound parameters (`database.md`). A template literal concatenating user input into query text is a defect, and table/column names are never taken from input.

## 3. Authorization on every object access

Authentication establishes *who*; authorization decides *what they may do* — to *this specific object*. IDOR is the classic miss: a handler that loads `/orders/:id` without checking the principal may access that order. Enforce through one policy path — a shared `preHandler` or a service-level check — never per-handler re-implementations that drift.

- The token is verified by a proven provider (OIDC); the service does not hand-roll JWT or session logic.
- In a multi-tenant service the tenant is bound to the authenticated principal and enforced in the data query (`WHERE tenant_id = principal.tenantId`) — never trusted from a path, query, or header.
- Least privilege: the database role and any cloud identity the service runs as start minimal and widen only on evidence.

## 4. Secrets are managed, never in code

No secret lives in source, in a committed `.env`, or baked into an image layer. The startup config schema proves presence and shape at boot (`node-services.md`); secret *values* are injected from the platform's secret manager at runtime. Secrets never reach logs: configure pino `redact` for known secret paths, and never put a secret in an error message or a URL.

The hierarchy is eliminate, then shorten, then rotate: prefer workload identity or OIDC federation (no static credential at all), then short-lived minted secrets, and reserve scheduled rotation for static credentials that genuinely cannot be made ephemeral.

## 5. Supply chain is part of the attack surface

Every npm package is a potential exploit vector — and npm packages run install scripts, so installation itself is an execution surface.

- `package-lock.json` is committed; CI installs with `npm ci`, never an unpinned resolve. `--ignore-scripts` in CI where the build allows it.
- `npm audit --omit=dev` runs on every build — dev-only advisories do not ship, so they do not block.
- A new dependency is a reviewed decision, not an intuition — check maintenance, ownership, install scripts, and transitive weight before adding it.
- Publish anything public with provenance (`npm publish --provenance`), so the artifact's origin is verifiable.

## 6. SSRF on outbound calls

A service that fetches a URL derived from input is an SSRF vector — an attacker aims it at cloud metadata endpoints or private hosts. Outbound targets are allowlisted, not reflected from the request:

```ts
const ALLOWED_HOSTS = new Set(["api.partner.example", "cdn.partner.example"]);

function assertAllowed(url: string): URL {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || !ALLOWED_HOSTS.has(parsed.hostname)) {
    throw new PermanentUpstreamError(`outbound host not allowed: ${parsed.hostname}`);
  }
  return parsed;
}
```

Allowlist beats denylist — private-range denylists lose to redirects and DNS tricks. Every outbound call carries a timeout (`AbortSignal.timeout`) so a hostile or slow upstream cannot exhaust the service.

## 7. Deserialization and prototype pollution

`JSON.parse` is safe; what you do with the result is not. Deep-merging parsed input into objects lets `__proto__`/`constructor` keys poison every object in the process — zod `.strict()` schemas drop them, and any hand-rolled merge of untrusted objects uses a null-prototype target or rejects those keys. Never run `eval`, `new Function`, or a `vm` context on input, and never deserialize formats that encode behaviour from untrusted sources.

## Anti-Patterns

- **`as`-casting `request.body`.** Bypasses validation; parse a `.strict()` zod schema.
- **String-built SQL.** Bind every value; identifiers never come from input.
- **Per-handler permission checks that drift.** Authorize through one policy path; check the object, not just the route.
- **Trusting the tenant from the URL.** The tenant comes from the verified principal, enforced in the query.
- **Secrets in `.env`, an image layer, or a log line.** Inject at runtime; redact in pino.
- **Unpinned installs in CI.** `npm ci` against the committed lockfile; audit every build.
- **Fetching an input-supplied URL unchecked.** Allowlist the host; require HTTPS.
- **Returning `err.message` to the client.** Log the detail, return a code and a trace id (`api-standards.md`).
- **"It is an internal service, skip auth."** Internal services are an attacker's favourite foothold — zero trust between services.
