# Routing & Navigation

## File-Based Routing

Next.js App Router uses the filesystem to define routes. Each folder in `app/` is a route segment, and special files within define the UI for that segment.

| File | Purpose | Client Component? |
|------|---------|-------------------|
| `page.tsx` | Renders the UI for this route | No (RSC default) |
| `layout.tsx` | Shared wrapper for this segment and children | No |
| `loading.tsx` | Loading state (auto-wraps page in Suspense) | No |
| `error.tsx` | Error boundary for this segment | **Yes** |
| `not-found.tsx` | 404 UI for this segment | No |
| `route.ts` | API endpoint (no React rendering) | N/A |
| `template.tsx` | Like layout, but re-renders on every navigation | No |
| `default.tsx` | Fallback for parallel route slots — **required**, see Parallel Routes below | No |

---

## Route Segments

```
app/
├── orders/                # Static: /orders
├── [id]/                  # Dynamic: /:id
├── [...slug]/             # Catch-all: /a/b/c (requires at least one segment)
├── [[...slug]]/           # Optional catch-all: / or /a/b/c
├── (dashboard)/           # Route group — ignored in URL
└── _components/           # Private folder — excluded from routing
```

Route groups `(name)` organise routes without affecting the URL — use them to apply different layouts to subsets of routes. Prefix a folder with `_` to exclude it from routing, for co-located components that shouldn't become routes.

---

## Proxy

The project-root file that runs before every request. Next.js 16 renamed it from `middleware.ts`/`middleware()`/`config` to `proxy.ts`/`proxy()`/`proxyConfig` — see `references/version-corrections.md` if the codebase predates the rename.

```tsx
// proxy.ts (project root)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const token = request.cookies.get('auth-token');

  if (!token && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const proxyConfig = {
  matcher: ['/dashboard/:path*', '/settings/:path*'],
};
```

---

## Parallel Routes

Parallel routes render multiple pages simultaneously in the same layout. Each slot renders independently and can have its own loading and error states.

```
app/
├── @modal/                     # Parallel route slot
│   ├── default.tsx             # Required — returns null
│   └── (.)orders/[id]/         # Intercepts /orders/:id
│       └── page.tsx            # Modal content
├── orders/
│   ├── page.tsx                # /orders (gallery/list)
│   └── [id]/
│       └── page.tsx            # /orders/:id (full page)
├── layout.tsx                  # Receives children + modal slot
└── page.tsx
```

```tsx
// app/layout.tsx
export default function RootLayout({
  children, modal,
}: { children: React.ReactNode; modal: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        {modal}
      </body>
    </html>
  );
}
```

Every parallel route slot **must** have a `default.tsx` that returns `null`. Without it, refreshing any page returns a 404 because Next.js cannot determine what to render in the empty slot:

```tsx
// app/@modal/default.tsx
export default function Default() {
  return null;
}
```

---

## Intercepting Routes

Intercepting routes show a different UI when navigating from within the app versus accessing the URL directly. Combined with parallel routes, they enable modal patterns.

| Matcher | Intercepts | Example |
|---------|-----------|---------|
| `(.)` | Same level | `@modal/(.)orders` intercepts `/orders` |
| `(..)` | One level up | `@modal/(..)settings` intercepts `/settings` from a child |
| `(..)(..)` | Two levels up | Rarely used |
| `(...)` | From root | `@modal/(...)orders` intercepts `/orders` from anywhere |

These match **route segments**, not filesystem paths — `(..)` means "parent route segment," not "parent folder."

| Navigation Type | What Renders |
|----------------|-------------|
| **Soft navigation** (clicking a Link) | Intercepting route (modal) |
| **Hard navigation** (URL bar, refresh, bookmark) | Full page (not intercepted) |

---

## Modal Pattern

The complete pattern for an intercepting modal:

```tsx
// app/orders/page.tsx — Link triggers interception
import Link from 'next/link';

export default async function OrdersPage() {
  const orders = await getOrders();
  return (
    <div className="bento-grid">
      {orders.data.map(order => (
        <Link key={order.id} href={`/orders/${order.id}`}>
          <OrderCard order={order} />
        </Link>
      ))}
    </div>
  );
}
```

```tsx
// app/@modal/(.)orders/[id]/page.tsx — intercepting route renders the modal
import { getOrder } from '@/lib/api';
import { Modal } from '@/components/ui/modal';

type Props = { params: Promise<{ id: string }> };

export default async function OrderModal({ params }: Props) {
  const { id } = await params;
  const order = await getOrder(id);
  return (
    <Modal>
      <h2>Order {order.id}</h2>
      <p>{order.status}</p>
    </Modal>
  );
}
```

Use `router.back()` to close modals — never `router.push('/')` or `<Link href="/">`. `router.back()` removes the intercepted route from history and unmounts the modal properly; `router.push('/')` adds a new history entry (so the back button reopens the modal) and leaves intercept state dangling.

```tsx
// components/ui/modal.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';

export function Modal({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') router.back();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [router]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) router.back();
    },
    [router],
  );

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'oklch(0 0 0 / 0.5)' }}
    >
      <div className="surface-elevated max-w-2xl w-full mx-4 p-6">
        <button onClick={() => router.back()} className="absolute top-4 right-4" aria-label="Close">
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}
```

---

## Navigation Hooks

All navigation hooks require `"use client"`.

| Hook | Purpose | Needs Suspense? |
|------|---------|----------------|
| `useRouter()` | Programmatic navigation (`push`, `replace`, `back`, `refresh`) | No |
| `usePathname()` | Current pathname as string | Yes (dynamic routes) |
| `useSearchParams()` | Read URL search parameters | **Yes (always)** |
| `useParams()` | Access dynamic route parameters | No |
| `useSelectedLayoutSegment()` | Active child segment (one level) | No |
| `useSelectedLayoutSegments()` | All active segments below layout | No |
| `useLinkStatus()` | Check if a `<Link>` is being prefetched (`'pending'` or `'idle'`) | No |

---

## Suspense Boundaries for Hooks

`useSearchParams()` always requires a Suspense boundary. Without one, the entire page bails out to client-side rendering:

```tsx
// Bad — entire page becomes CSR
'use client';
import { useSearchParams } from 'next/navigation';
export default function SearchPage() {
  const searchParams = useSearchParams();
  return <div>Query: {searchParams.get('q')}</div>;
}

// Good — wrap in Suspense
import { Suspense } from 'react';
export default function SearchPage() {
  return (
    <Suspense fallback={<div>Loading search…</div>}>
      <SearchContent />
    </Suspense>
  );
}
```

`usePathname()` requires a Suspense boundary in dynamic routes (`[param]` segments) unless `generateStaticParams` is used, in which case the path is known at build time and the boundary is optional.

---

## Static Route Pre-rendering

`generateStaticParams` pre-renders dynamic routes at build time, eliminating server-side rendering on each request for known pages:

```tsx
// app/orders/[id]/page.tsx
export async function generateStaticParams() {
  const orders = await getOrders();
  return orders.data.map(order => ({ id: order.id }));
}
```

Pages it returns are statically rendered at build time; pages with dynamic params not returned are rendered on-demand and then cached.
