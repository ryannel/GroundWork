# Version Corrections

Where the model's training data is stale. This file is a checklist, not a tutorial — each item names what changed, why it bites, and the minimal fix. Verify against `package.json` before applying; a project pinned to an older Next.js may not carry all of these yet.

## Async `params` / `searchParams` (Next.js 15+)

`params` and `searchParams` are `Promise`s in pages, layouts, `generateMetadata`, and Route Handlers — pre-2024 training data shows them synchronous.

```tsx
type Props = { params: Promise<{ id: string }> };
export default async function Page({ params }: Props) {
  const { id } = await params;
}
```

In a component that cannot be `async` (it also uses hooks), unwrap with `React.use()` instead of `await`:

```tsx
'use client';
import { use } from 'react';
export default function Page({ params }: Props) {
  const { id } = use(params);
}
```

Migrating an older codebase: `pnpx @next/codemod@latest next-async-request-api .`

## Async `cookies()` / `headers()` (Next.js 15+)

Both are `Promise`s now — `await cookies()`, `await headers()`. A pre-15 snippet reading `cookies().get(...)` synchronously will not type-check.

## `proxy.ts` replaces `middleware.ts` (Next.js 16)

Next.js 16 renamed middleware to *proxy* — the file, export, and config key all changed:

| | v14–15 | v16+ |
|---|---|---|
| File | `middleware.ts` | `proxy.ts` |
| Export | `middleware()` | `proxy()` |
| Config | `config` | `proxyConfig` |

Migrate with `pnpx @next/codemod@latest upgrade`. Current shape: `references/routing-and-navigation.md` → Proxy.

## `'use cache'` (Cache Components)

A new directive — not `'use client'`/`'use server'` — that caches a function or component's result. Requires `cacheComponents: true` in `next.config.ts`; pair with `cacheLife()`/`cacheTag()` for duration and invalidation. Training data predating this feature omits it entirely.

## Navigation APIs throw — never bare try/catch them

`redirect()`, `permanentRedirect()`, `notFound()`, `forbidden()`, and `unauthorized()` work by throwing an internal error. A try/catch wrapping one of these swallows the navigation silently — the "error" is caught and the redirect never happens. Call them outside the try/catch, or re-throw with `unstable_rethrow(error)` when they must be inside one. Full treatment: `references/error-boundaries.md` → Navigation API Gotcha.

## `default.tsx` is required for every parallel-route slot

Omitting it makes a hard refresh on any sibling route 404 — Next.js has no fallback for the empty slot without it. `references/routing-and-navigation.md` → Parallel Routes.

## Hydration mismatches: server and client must render identical HTML

The recurring causes: reading `window`/`localStorage` during render, locale- or timezone-dependent `Date` formatting, and `Math.random()`/non-deterministic IDs (use `useId()` instead). All three need the value deferred to a client-only effect, not a fix to the render path itself. `references/error-boundaries.md` → Hydration Errors.

## Tailwind v4: no `tailwind.config.ts`

Tailwind v4 is CSS-first — there is no JS config file; `@theme` blocks in CSS replace it, and `darkMode: 'class'` becomes `@custom-variant dark (&:is(.dark *))`. A generated `tailwind.config.ts` from an older tutorial does not apply here. `references/tailwind-and-styling.md`.

## `metadata` / `generateMetadata` — Server Components only

Both are unsupported in any file carrying `'use client'`. A page needing both client interactivity and metadata splits: the Server Component parent exports `metadata`/`generateMetadata`, client logic moves to a child component.
