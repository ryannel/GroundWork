# Data Fetching

## Decision Tree

```
Need to fetch data?
├── From a Server Component?
│   └── Fetch directly via lib/api.ts — no API route needed
│
├── From a Client Component?
│   ├── Is it a read (GET)?
│   │   ├── Can the data be fetched in a parent Server Component?
│   │   │   └── YES → Fetch on server, pass as props, seed SWR via fallback
│   │   └── NO → Use SWR hook from hooks/use-data.ts
│   │
│   └── Is it a mutation (POST/PUT/DELETE)?
│       └── Use a Server Action (see mutations-and-forms.md)
│
├── Need external API access (webhooks, third parties)?
│   └── Use a Route Handler (app/api/*/route.ts)
│
└── Need REST API for mobile app or external clients?
    └── Use a Route Handler
```

The rule: **never use `useEffect` for data fetching** in the Next.js application. All client-side data fetching goes through SWR, which provides caching, deduplication, revalidation, and focus-aware refetching out of the box.

---

## Server Component Fetching

Server Components can fetch data directly — no API route, no SWR hook, no loading state. The data is available before the component renders.

```tsx
// app/orders/page.tsx
import { getOrders } from '@/lib/api';
import { OrderList } from '@/components/orders';

export default async function OrdersPage() {
  const orders = await getOrders();
  return <OrderList orders={orders} />;
}
```

This is the preferred approach for initial page data because:
- No API round-trip (the server can call the Go backend directly)
- Secrets stay on the server (API keys, auth tokens)
- No client-server waterfall
- No loading state needed for initial render

---

## SWR Hook Pattern

All SWR data-fetching hooks live in `hooks/`. Each hook depends only on the API Client (`lib/api.ts`) and Schemas (`lib/schemas/`).

```tsx
// hooks/use-orders.ts
'use client';

import useSWR from 'swr';
import { getOrders, getOrder } from '@/lib/api';
import type { Order, OrderList } from '@/lib/schemas';

export function useOrders() {
  return useSWR<OrderList>('/api/orders', getOrders);
}

export function useOrder(id: string) {
  return useSWR<Order>(id ? `/api/orders/${id}` : null, () => getOrder(id));
}
```

```tsx
// Usage in a Client Component
'use client';

import { useOrders } from '@/hooks/use-orders';

export function OrderDashboard() {
  const { data, error, isLoading } = useOrders();

  if (isLoading) return <OrderListSkeleton />;
  if (error) return <ErrorState message="Failed to load orders" />;

  return (
    <ul>
      {data.data.map(order => (
        <li key={order.id}>{order.id}</li>
      ))}
    </ul>
  );
}
```

SWR is configured globally in the root layout or a provider component (`revalidateOnFocus`, `revalidateOnReconnect`, `dedupingInterval`, `errorRetryCount`) — set project-wide defaults there once, not per hook.

---

## Hydration Seeding

Seed client-side SWR hooks by wrapping Server Components in `<SWRConfig value={{ fallback }}>`. This eliminates the flash of loading state on the client — the SWR hook immediately has data to render.

```tsx
// app/orders/page.tsx — Server Component
import { SWRConfig } from 'swr';
import { getOrders } from '@/lib/api';
import { OrderDashboard } from '@/components/orders';

export default async function OrdersPage() {
  const orders = await getOrders(); // fetched on the server

  return (
    <SWRConfig value={{ fallback: { '/api/orders': orders } }}>
      <OrderDashboard />
    </SWRConfig>
  );
}
```

The SWR cache key in the `fallback` object must exactly match the key used in the `useSWR` call — if the hook uses `/api/orders`, the fallback key must be `/api/orders`. A mismatch fails silently: the hook just refetches instead of using the seed.

---

## Avoiding Data Waterfalls

Sequential fetches create waterfalls — each request waits for the previous one to complete.

### Parallel Fetching with Promise.all

When a component needs multiple independent datasets, fetch them in parallel rather than awaiting each in turn:

```tsx
// Good — parallel fetching
async function DashboardPage() {
  const [orders, users, analytics] = await Promise.all([
    getOrders(),
    getUsers(),
    getAnalytics(),
  ]);
  return <Dashboard orders={orders} users={users} analytics={analytics} />;
}
```

### Streaming with Suspense

Let each section load independently. Fast sections render immediately; slow sections show a skeleton and stream in when ready.

```tsx
import { Suspense } from 'react';

async function DashboardPage() {
  return (
    <div>
      <Suspense fallback={<OrdersSkeleton />}>
        <OrdersSection />
      </Suspense>
      <Suspense fallback={<AnalyticsSkeleton />}>
        <AnalyticsSection />
      </Suspense>
    </div>
  );
}

async function OrdersSection() {
  const orders = await getOrders();
  return <OrderList orders={orders} />;
}
```

### Preload Pattern

Start fetching early with `React.cache`, then consume the result later when the data is needed — the second call is deduplicated, not a second request:

```tsx
import { cache } from 'react';

export const getOrder = cache(async (id: string) => fetchOrderFromApi(id));

export const preloadOrder = (id: string) => {
  void getOrder(id); // fire and forget — starts the fetch
};
```

```tsx
export default async function OrderPage({ params }: Props) {
  const { id } = await params;
  preloadOrder(id);              // start fetching immediately
  // ... other work ...
  const order = await getOrder(id); // data likely ready by now
  return <OrderDetail order={order} />;
}
```

---

## Optimistic UI

When a user triggers an action, immediately update the local SWR cache using `mutate()` before receiving server confirmation. Revert if the Server Action returns an error.

```tsx
'use client';

import { useOrders } from '@/hooks/use-orders';
import { deleteOrderAction } from '@/app/actions/order-actions';
import { useSWRConfig } from 'swr';

export function OrderCard({ order }: { order: Order }) {
  const { mutate } = useSWRConfig();

  async function handleDelete() {
    // 1. Optimistically remove from the UI
    mutate(
      '/api/orders',
      (current: OrderList | undefined) =>
        current && { ...current, data: current.data.filter(o => o.id !== order.id) },
      { revalidate: false }, // don't refetch yet
    );

    // 2. Perform the actual deletion
    const result = await deleteOrderAction(order.id);

    if (result.error) {
      mutate('/api/orders'); // 3. revert on failure — refetch the real data
      toast.error(result.error);
    }
  }

  return (
    <article>
      <h2>Order {order.id}</h2>
      <button onClick={handleDelete}>Delete</button>
    </article>
  );
}
```

This makes the UI feel instant. The user sees the order disappear immediately; if the server fails, it reappears with an error toast.

---

## Route Handlers

Route Handlers (`route.ts`) create API endpoints. Use them for external consumers — mobile clients, webhooks, third parties — never for internal page data or client reads, which have a cheaper path.

| Use Case | Route Handler | Server Component | Server Action |
|----------|:---:|:---:|:---:|
| Internal page data | | ✅ | |
| Client-side reads (SWR) | ✅ | | |
| Form mutations | | | ✅ |
| External API (mobile, third party) | ✅ | | |
| Webhooks from external services | ✅ | | |
| Cacheable GET endpoints | ✅ | | |

A `route.ts` and `page.tsx` cannot coexist in the same folder — separate API routes from page routes under `app/api/`. Route Handlers run server-only: `async/await`, `cookies()`, `headers()`, and Node.js APIs are available; React hooks, React DOM APIs, and rendering React components are not.

---

## Client Component Data Fetching

When a Client Component needs data, prefer passing it from a parent Server Component; an SWR hook is the fallback when data must refresh independently.

```tsx
// Preferred — Server Component passes pre-fetched data
async function Page() {
  const data = await fetchData();
  return <ClientComponent initialData={data} />;
}

// Fallback — SWR hook when the data must refresh on its own
'use client';
function OrderDashboard() {
  const { data, error, isLoading } = useOrders();
  if (isLoading) return <Skeleton />;
  return <OrderList orders={data.data} />;
}
```

`useEffect` + `fetch` is forbidden in this codebase — every SWR hook already provides caching, deduplication, and revalidation that a hand-rolled effect would have to reinvent.

---

## The API Client Layer

`lib/api.ts` contains one function per Go REST endpoint. It depends only on schemas.

```tsx
// lib/api.ts
import { orderSchema, orderListSchema, type Order, type OrderList } from '@/lib/schemas';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

export async function getOrders(): Promise<OrderList> {
  const res = await fetch(`${API_BASE}/v1/orders`);
  if (!res.ok) throw new Error(`Failed to fetch orders: ${res.status}`);
  return orderListSchema.parse(await res.json());
}

export async function getOrder(id: string): Promise<Order> {
  const res = await fetch(`${API_BASE}/v1/orders/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch order: ${res.status}`);
  return orderSchema.parse(await res.json());
}
```

Every response is parsed through a Zod schema. If the Go backend changes a field name or adds a required field, the parse call throws immediately with a clear error — not a silent runtime bug three layers up.
