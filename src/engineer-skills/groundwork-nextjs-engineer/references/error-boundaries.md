# Error Boundaries

## Error Hierarchy

Errors bubble up from the component that throws to the nearest error boundary. Place `error.tsx` at different levels to control the granularity of error recovery.

```
app/
├── error.tsx               # Catches errors from all children
├── global-error.tsx        # Catches errors in root layout
├── orders/
│   ├── error.tsx           # Catches errors in /orders/*
│   └── [id]/
│       ├── error.tsx       # Catches errors in /orders/[id]
│       └── page.tsx
└── layout.tsx               # Errors here go to global-error.tsx
```

An `error.tsx` boundary does **not** catch errors thrown in the `layout.tsx` of the same segment — those bubble up to the parent segment's error boundary or `global-error.tsx`.

---

## error.tsx

Catches runtime errors in a route segment and its children. Provides a `reset` function to retry rendering. `error.tsx` **must** be a Client Component.

```tsx
// app/orders/error.tsx
'use client';

export default function OrdersError({
  error, reset,
}: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="surface-glass p-6 text-center" role="alert">
      <h2 className="text-destructive">Something went wrong</h2>
      <p className="text-muted-foreground mt-2">Failed to load orders. This has been logged.</p>
      <button onClick={reset} className="mt-4 px-4 py-2 bg-primary rounded">Try again</button>
    </div>
  );
}
```

The `digest` property is a hash of the error thrown on the server — use it for log correlation, never display it to users. Sensitive error details (stack traces, internal messages) are stripped before reaching the client; only generic messages should be shown.

---

## Other Boundary Files

| File | Catches | Requirement |
|------|---------|-------------|
| `global-error.tsx` | Errors in the root layout | Must render its own `<html>`/`<body>` — the root layout is replaced entirely; keep it self-contained, no app CSS imports |
| `not-found.tsx` | Explicit `notFound()` calls, unmatched routes | Place at any level to customise the 404 for that section |
| `unauthorized.tsx` | Explicit `unauthorized()` calls (401) | — |
| `forbidden.tsx` | Explicit `forbidden()` calls (403) | — |

```tsx
import { notFound, forbidden, unauthorized } from 'next/navigation';

export default async function OrderPage({ params }: Props) {
  const { id } = await params;
  const session = await getSession();
  if (!session) unauthorized();                      // renders unauthorized.tsx
  if (!session.hasAdminAccess) forbidden();           // renders forbidden.tsx
  const order = await getOrder(id);
  if (!order) notFound();                             // renders closest not-found.tsx
  return <OrderDetail order={order} />;
}
```

Each of these boundary components follows the same shape as `error.tsx` above — a `surface-glass` panel with a heading, an explanatory line, and (for `error.tsx`/`global-error.tsx`) a retry action.

---

## Navigation API Gotcha

`redirect()`, `permanentRedirect()`, `notFound()`, `forbidden()`, and `unauthorized()` work by throwing special internal errors. A try/catch wrapping one of these intercepts the navigation error, and the navigation fails silently — see `references/version-corrections.md` for the one-line version of this gotcha.

```tsx
// Bad — try/catch swallows the redirect() throw
'use server';
async function createOrder(formData: FormData) {
  try {
    const order = await db.order.create({ ... });
    redirect(`/orders/${order.id}`); // this throws!
  } catch (error) {
    return { error: 'Failed to create order' }; // redirect never happens
  }
}

// Fix 1 — call the navigation API outside the try/catch
async function createOrder(formData: FormData) {
  let order;
  try {
    order = await db.order.create({ ... });
  } catch (error) {
    return { error: 'Failed to create order' };
  }
  redirect(`/orders/${order.id}`);
}

// Fix 2 — re-throw with unstable_rethrow when the call must stay inside
import { unstable_rethrow } from 'next/navigation';
async function createOrder(formData: FormData) {
  try {
    const order = await db.order.create({ ... });
    redirect(`/orders/${order.id}`);
  } catch (error) {
    unstable_rethrow(error); // re-throws Next.js internal errors
    return { error: 'Failed to create order' };
  }
}
```

---

## Redirects

```tsx
import { redirect, permanentRedirect } from 'next/navigation';

redirect('/new-path');            // 307 temporary — most cases (auth redirects, feature gates)
permanentRedirect('/new-url');    // 308 permanent — URL migrations browsers should cache
```

---

## Hydration Errors

Hydration errors occur when the server-rendered HTML doesn't match the client-rendered HTML — React detects the mismatch and throws. Causes and fixes:

| Cause | Fix |
|-------|-----|
| Reading `window`/`localStorage` during render | Render on client only after mount (`useEffect` + `useState`) |
| `Date`/timezone-dependent formatting | Same — defer to a client-only effect |
| `Math.random()` or non-deterministic IDs | Use `useId()` for stable cross-render IDs |
| Invalid HTML nesting (`<div>` in `<p>`, `<p>` in `<p>`) | Fix the markup — this is invalid HTML, not a Next.js issue |
| Browser extensions / third-party scripts injecting DOM | Use `next/script` with `strategy="afterInteractive"`; if the error disappears in Incognito, an extension is the cause, not the app |

In development, click the hydration error overlay for a diff of server vs. client HTML — it pinpoints the exact mismatched element.

---

## Post-Response Work with after()

`after()` runs code after the response finishes streaming — logging, analytics, or cleanup that shouldn't delay the response. It does not block the response; the client receives it immediately while the deferred work runs in the background.

```tsx
import { after } from 'next/server';

export async function POST(request: Request) {
  const data = await processRequest(request);
  after(async () => {
    await logAnalytics(data);
    await sendNotification(data);
  });
  return Response.json({ success: true });
}
```
