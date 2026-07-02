# Type System & Schemas

## Zod as the Contract

Zod schemas are the single source of truth for all data shapes in the codebase — the type contract between the Go backend API and the React frontend. Every API response is validated against a Zod schema; every TypeScript type for API data is derived from one. Standalone TypeScript interfaces for API data are forbidden — they drift from reality.

```tsx
// lib/schemas/order.ts
import { z } from 'zod';

export const orderSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled']),
  customer_id: z.string().uuid(),
  quantity: z.number().int().positive(),
  note: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Order = z.infer<typeof orderSchema>;

export const orderListSchema = z.object({
  data: z.array(orderSchema),
  pagination: z.object({ next_cursor: z.string().nullable(), has_more: z.boolean() }),
});

export type OrderList = z.infer<typeof orderListSchema>;
```

Runtime validation catches a backend field rename or type change immediately, at the parse call — not as a silent bug three layers up. The schema also plugs directly into `react-hook-form` via `@hookform/resolvers/zod`, so form validation and API validation stay a single definition.

---

## Schema Organisation

All schemas live in `lib/schemas/` with zero internal application dependencies — a schema file never imports from hooks, components, contexts, or the API client.

```
lib/schemas/
├── order.ts                   # Order entity schemas
├── user.ts                    # User entity schemas
├── common.ts                  # Shared schemas (pagination, ActionResult)
└── index.ts                   # Barrel export
```

Each file exports the schema object, the inferred type, and any sub-schemas needed for forms or partial updates.

---

## Deriving Types

Always derive types from schemas using `z.infer` — never write a parallel TypeScript interface; it will drift.

```tsx
// Correct
export const orderSchema = z.object({ /* ... */ });
export type Order = z.infer<typeof orderSchema>;

// Incorrect — duplicates the schema and will drift
export interface Order { id: string; status: string; /* ... */ }
```

Derive form-specific types from the base schema with `.pick()` and `.partial().omit()`:

```tsx
export const createOrderSchema = orderSchema.pick({ customer_id: true, quantity: true, note: true });
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const updateOrderSchema = orderSchema.partial().omit({ id: true, created_at: true, updated_at: true });
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
```

---

## Discriminated Unions

Use discriminated unions to model mutually exclusive states — the compiler then enforces that only valid field combinations are accessed, preventing impossible states.

```tsx
// Correct — the compiler knows which fields exist based on `type`
const orderSourceSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('web'), session_id: z.string() }),
  z.object({ type: z.literal('phone'), agent_id: z.string() }),
]);

function processSource(source: z.infer<typeof orderSourceSchema>) {
  switch (source.type) {
    case 'web': return trackSession(source.session_id);       // session_id known present
    case 'phone': return logAgent(source.agent_id);           // agent_id known present
  }
}

// Incorrect — loose optionals allow impossible states
const orderSourceSchema = z.object({
  type: z.enum(['web', 'phone']),
  session_id: z.string().optional(),  // when is this present?
  agent_id: z.string().optional(),    // what if type is 'web'?
});
// Nothing prevents { type: 'web', agent_id: 'x' }
```

---

## Exhaustive Matching

Enforce exhaustive matching on discriminated unions with `default: never` — this catches an unhandled case at compile time the moment a new variant is added.

```tsx
function getStatusLabel(status: Order['status']): string {
  switch (status) {
    case 'pending': return 'Pending';
    case 'processing': return 'Processing';
    case 'shipped': return 'Shipped';
    case 'delivered': return 'Delivered';
    case 'cancelled': return 'Cancelled';
    default: {
      const _exhaustive: never = status; // compile error when a status is added and unhandled
      return _exhaustive;
    }
  }
}
```

---

## The Result Pattern

Every Server Action returns a strictly typed `ActionResult<T>` — a Server Action must never throw, only return a result. This is what prevents an unhandled client-side crash from a failed mutation.

```tsx
// lib/schemas/common.ts
export type ActionResult<T> =
  | { data: T; error: null }
  | { data: null; error: string };
```

The caller narrows on `result.error`:

```tsx
const result = await createOrderAction(formData);
if (result.error) {
  toast.error(result.error); // TypeScript knows result.data is null
  return;
}
toast.success(`Created order ${result.data.id}`); // TypeScript knows result.data is Order
```

Full Server Action implementation and form wiring: `references/mutations-and-forms.md`.

---

## RSC Serialisation Boundary

Props passed from a Server Component to a Client Component must be JSON-serialisable — React serialises them across the boundary, and non-serialisable values silently corrupt or crash.

| Type | Serialisable? | Notes |
|------|-------------|-------|
| `string`, `number`, `boolean`, `null`, `undefined` | Yes | |
| Plain objects and arrays | Yes | No class instances |
| Server Actions (`'use server'`) | Yes | The only exception for functions |
| `Date` | **No** | Silently becomes a string — `.getFullYear()` crashes on the client |
| `Map`, `Set` | **No** | Silently stripped |
| Functions (non-Server Action), class instances, `Symbol` | **No** | Cannot cross the boundary |

```tsx
// Bad — Date object silently becomes a string, then crashes on the client
<OrderCard createdAt={order.created_at} />

// Good — serialise on the server
<OrderCard createdAt={order.created_at.toISOString()} />

// Bad — Map cannot be serialised
<ClientComponent items={new Map([['a', 1]])} />
// Good
<ClientComponent items={Object.fromEntries(map)} />
```

---

## Type Guards over any

`any` is forbidden. For unknown data (external APIs, dynamic content, user input), use `unknown` and narrow with a type guard or Zod parsing.

```tsx
// Bad — any bypasses all type checking
function processResponse(data: any) {
  return data.orders[0].id; // no type safety — runtime explosion
}

// Good — unknown + Zod parsing
function processResponse(data: unknown) {
  const parsed = orderListSchema.safeParse(data);
  if (!parsed.success) throw new Error(`Invalid API response: ${parsed.error.message}`);
  return parsed.data.data[0].id; // fully typed
}

// Good — type guard for narrowing
function isOrder(value: unknown): value is Order {
  return orderSchema.safeParse(value).success;
}
```
