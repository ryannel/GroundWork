# Server Components & Client Boundaries

## RSC by Default

Every component in the Next.js application is a React Server Component unless explicitly marked otherwise. Server Components run on the server, have zero client-side JavaScript overhead, and can directly fetch data, read cookies, and access server-only resources — including `params`/`searchParams` and `cookies()`/`headers()`, which are async; see `references/version-corrections.md` before writing a signature by hand.

Add the `"use client"` directive only when the component strictly requires:
- React hooks (`useState`, `useEffect`, `useRef`, `useContext`, etc.)
- Event handlers (`onClick`, `onChange`, `onSubmit`)
- Browser APIs (`window`, `localStorage`, `IntersectionObserver`)
- Third-party libraries that rely on browser APIs

If a component only needs interactivity in a small subtree, keep the parent as a Server Component and push the `"use client"` boundary as far down the tree as possible.

```tsx
// Server Component (default) — no directive needed
export default async function OrderPage({ params }: Props) {
  const { id } = await params;
  const order = await getOrder(id);

  return (
    <article>
      <h1>Order {order.id}</h1>
      <OrderStatus status={order.status} />  {/* Server Component */}
      <DeliveryMap orderId={id} />            {/* Client Component — needs geolocation API */}
    </article>
  );
}

// Only the leaf that needs interactivity is a client component
// components/orders/delivery-map.tsx
'use client';

import { useEffect, useState } from 'react';

export function DeliveryMap({ orderId }: { orderId: string }) {
  const [position, setPosition] = useState<GeolocationPosition>();
  // Browser API usage justified
  useEffect(() => {
    const id = navigator.geolocation.watchPosition(setPosition);
    return () => navigator.geolocation.clearWatch(id);
  }, []);
  return <div>{/* render map */}</div>;
}
```

---

## When to Add use client

Use this checklist. If none of these apply, the component should remain a Server Component.

| Requires | Example | Needs `"use client"`? |
|----------|---------|----------------------|
| `useState`, `useReducer` | Form state, toggle state | Yes |
| `useEffect`, `useRef` | DOM manipulation, timers | Yes |
| `useContext` | Theme, auth context | Yes |
| `onClick`, `onChange`, `onSubmit` | Button clicks, form input | Yes |
| `window`, `localStorage` | Feature detection, persistence | Yes |
| `useRouter`, `usePathname`, `useSearchParams` | Client-side navigation | Yes |
| SWR hooks | Data fetching/revalidation | Yes |
| Async data fetch | `await getOrder(id)` | **No** — Server Components can be async |
| Static rendering | Displaying data, formatting | **No** |
| Reading `cookies()`, `headers()` | Auth checks, locale | **No** — server functions |

---

## Patterns for Crossing the Boundary

### Pattern 1: Server Parent, Client Leaf

The most common pattern. Server Component fetches data and passes serialised props to a client component that adds interactivity.

```tsx
// Server Component — fetches and coordinates
export default async function OrdersPage() {
  const orders = await getOrders();

  return (
    <div>
      <h1>Orders</h1>
      <OrderFilters />                  {/* Client — needs useState for filter state */}
      <OrderList orders={orders} />     {/* Could be server or client */}
    </div>
  );
}
```

### Pattern 2: Client Component with Server Children

Client Components can render Server Components passed as `children`. This avoids pulling the entire subtree into the client bundle.

```tsx
// Client wrapper — provides interactive context
'use client';

export function CollapsibleSection({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <section>
      <button onClick={() => setIsOpen(!isOpen)}>Toggle</button>
      {isOpen && children}
    </section>
  );
}

// Server Component — passes server-rendered children
export default async function Page() {
  return (
    <CollapsibleSection>
      <OrderList />  {/* This remains a Server Component */}
    </CollapsibleSection>
  );
}
```

### Pattern 3: Hydration Seeding

Fetch data on the server in a Server Component and seed the client-side SWR cache so the client component renders immediately without a loading state. Full treatment, including the fallback-key contract: `references/data-fetching.md` → Hydration Seeding.

```tsx
// Server Component — seeds the cache
import { SWRConfig } from 'swr';
import { getOrders } from '@/lib/api';

export default async function OrdersPage() {
  const orders = await getOrders();

  return (
    <SWRConfig value={{ fallback: { '/api/orders': orders } }}>
      <OrderDashboard />
    </SWRConfig>
  );
}
```

Props crossing this boundary must be JSON-serialisable — a `Date`, `Map`, `Set`, or non-Server-Action function silently breaks or is stripped. Full rules: `references/type-system.md` → RSC Serialisation Boundary.

---

## Directives Beyond use client

`'use server'` marks Server Actions — covered in `references/mutations-and-forms.md`. `'use cache'` is a newer Cache Components primitive most training data predates entirely — see `references/version-corrections.md`.

---

## Runtime Selection

Default to the Node.js runtime for all routes and pages; only reach for `export const runtime = 'edge'` when the project already uses Edge elsewhere or there is a documented latency requirement Node.js cannot meet, and every dependency on the route is Edge-compatible (no `fs`, limited `crypto`, most npm packages unsupported).
