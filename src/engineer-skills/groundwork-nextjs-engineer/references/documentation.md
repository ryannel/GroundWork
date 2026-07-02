# Documentation

## Philosophy: Structure Over Comments

Comments are promises that no compiler can verify. When code changes, TypeScript catches type errors and Vitest catches behavioral regressions — but stale TSDoc comments silently mislead. In a codebase where AI agents drive significant code velocity, comment drift is not hypothetical; it is the default outcome.

**The hierarchy for TypeScript/React documentation:**
1. **TypeScript types and interfaces** — the compiler rejects incorrect types (zero drift risk)
2. **Zod `.describe()`** — part of the code; flows into validation errors and runtime behavior
3. **Naming** — descriptive component/function/variable names (refactor > comment)
4. **Test names** — executable documentation verified by CI
5. **TSDoc on complex public APIs** — only when types genuinely cannot convey the intent
6. **Inline "why" comments** — last resort for genuinely non-obvious decisions

Everything at levels 1-4 is verified by tooling. Levels 5-6 are human promises with drift risk. Minimize them ruthlessly.

---

## Types and Zod as Documentation

In the Next.js application codebase, **TypeScript types and Zod schemas are the primary documentation layer.** They are the single source of truth for data structures — verified by the compiler and used by the runtime.

### TypeScript Interfaces as Documentation

Well-typed interfaces make most prop/parameter documentation redundant:

```tsx
// The interface IS the documentation — no TSDoc needed
interface OrderCardProps {
  order: Order;
  onSelect?: (orderId: string) => void;
  variant?: "standard" | "elevated" | "inset";
}
```

The types `Order`, `string`, and the union type `"standard" | "elevated" | "inset"` communicate everything a consumer needs to know. Adding comments like `/** The order to display */` is noise.

### Zod `.describe()` as Documentation

Zod `.describe()` is structural documentation that flows into validation errors and can be extracted by tooling. It cannot drift because it IS the code:

```tsx
export const orderSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["pending", "processing", "shipped", "delivered"]),
  quantity: z.number().int().positive().describe("Number of units on this order"),
  placedAt: z.string().datetime().nullable(),
});
```

**Rule:** Use `.describe()` only when the field name and type constraints don't tell the full story. `id: z.string().uuid()` is already self-documenting — `.describe("Order ID")` is pure noise.

### When Types Are Enough

```tsx
// NO TSDoc needed — the types tell the complete story
function getOrder(id: string): Promise<Order | null>
function deleteOrder(id: string): Promise<void>
function listOrders(filter?: OrderFilter): Promise<Order[]>
```

---

## What to Document

| What | How | Why |
|------|-----|-----|
| **Complex exported function** | TSDoc only if the signature doesn't convey the contract | Edge cases, error conditions, non-obvious behavior |
| **Non-obvious props** | Comment on the interface property (not the component) | When the name + type isn't sufficient |
| **Hook caching/revalidation** | TSDoc on the hook | Cannot be inferred from the return type |
| **`"use client"` rationale** | Brief comment above the directive when it's non-obvious | Explains the architectural boundary decision |
| **Side effects** | Note in TSDoc if invisible in the signature | Mutations, cache invalidation, analytics |

---

## What NOT to Document

**Self-documenting components:**
```tsx
// BAD — the name + props type says everything
/** OrderCard displays a card for an order */
export function OrderCard({ order }: OrderCardProps) {

// GOOD — skip it; the name IS the documentation
export function OrderCard({ order }: OrderCardProps) {
```

**Obvious props:**
```tsx
// BAD — noise
interface DialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Called when the dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** The dialog title */
  title: string;
  /** The dialog content */
  children: React.ReactNode;
}

// GOOD — the names + types are the documentation
interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
}
```

**Comment only non-obvious props:**
```tsx
interface OrderCardProps {
  order: Order;

  /**
   * Memoize with `useCallback` to prevent re-renders
   * inside virtualized lists.
   */
  onSelect?: (orderId: string) => void;

  variant?: "standard" | "elevated" | "inset";
}
```

Here, `onSelect` has a non-obvious performance implication. The other props need no comments.

**Thin page components:**
```tsx
// SKIP — the delegation IS the documentation
export default async function OrdersPage() {
  const orders = await listOrders();
  return <OrderList orders={orders} />;
}
```

**shadcn/ui primitives** — generated code, never add comments.

**Zod fields where the name + constraints are clear:**
```tsx
// BAD — .describe() adds nothing
status: z.enum(["pending", "processing", "shipped", "delivered"]).describe("Order status")

// GOOD — skip .describe() when it would just restate the field name
status: z.enum(["pending", "processing", "shipped", "delivered"])
```

**Tailwind utility classes** — the class names are the documentation.

---

## Component Documentation

TSDoc on components is justified **only** when the component has non-obvious behavior that types cannot convey:

```tsx
/**
 * Inline order note editor with optimistic updates.
 *
 * Submits via Server Action and optimistically updates the SWR cache.
 * Rolls back automatically on server error.
 */
"use client";

export function OrderNoteEditor({ order }: OrderNoteEditorProps) {
```

The optimistic update + rollback behavior is invisible in the props — it justifies documentation. A simple `OrderCard` that just renders data does not.

---

## Server and Client Boundary Notes

The default is React Server Component — no documentation needed. Document the boundary **only** when using `"use client"` and the rationale is non-obvious:

```tsx
/**
 * Client Component: requires useState for search input tracking
 * and useTransition for non-blocking updates.
 */
"use client";

export function OrderSearch({ initialResults }: OrderSearchProps) {
```

**Skip** when `"use client"` is obviously needed (event handlers, form state):
```tsx
// No boundary comment needed — "use client" is obviously required
// for onClick handlers and useState
"use client";

export function OrderForm({ onSubmit }: OrderFormProps) {
```

---

## Hook Documentation

Custom hooks are the one area where TSDoc is frequently justified — the caching and revalidation behavior cannot be inferred from the return type:

```tsx
/**
 * Fetches an order by ID with SWR caching.
 * Revalidates on focus and reconnect.
 * Seed with SWRConfig fallback to avoid loading flash.
 */
export function useOrder(orderId: string) {
  return useSWR<Order>(`/api/orders/${orderId}`, fetcher);
}
```

**Skip** for trivial hooks:
```tsx
// No TSDoc needed — the name + signature are clear
export function useTheme() {
  return useContext(ThemeContext);
}
```

---

## Inline Comments

Inline comments within components or functions explain **why**, never **what**:

```tsx
export function OrderList({ orders }: OrderListProps) {
  // Sort descending — server returns chronological, dashboard needs reverse.
  const sorted = useMemo(
    () => [...orders].sort((a, b) =>
      new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime()
    ),
    [orders]
  );

  return (
    // Fragment avoids extra div that breaks parent CSS grid layout.
    <>
      {sorted.map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}
    </>
  );
}
```

---

## In-Code Markers

```tsx
// TODO(bob): Add virtual scrolling for lists > 100 items. Issue #234.

// FIXME(carol): Race between optimistic update and SWR revalidation
// causes flicker. Needs mutate() with rollback.

// HACK(dave): Workaround for Next.js 16 searchParams Suspense
// requirement. Remove when framework provides a built-in solution.
```

Always include `(username)` and issue reference.

---

## Service README Template

The app lives inside the workspace monorepo, so its README is a lean orientation page — purpose, how to run it, configuration — not a standalone open-source front door. No clone instructions, badges, or license stanza.

```markdown
# [App Name]

One-sentence description of what this frontend does.

## Architecture

\```
Pages (app/)
  └── Features (components/<domain>/)
        └── UI Primitives (components/ui/)
        └── Hooks (hooks/)
              └── API Client (lib/api.ts)
                    └── Schemas (lib/schemas/)
\```

## Quick Start

\```bash
cp .env.example .env.local
./dev start
\```

App: `http://localhost:3000`

## Configuration

| Variable | Default | Description |
|----------|---------|--------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8080` | Backend API |
| `NEXT_PUBLIC_APP_ENV` | `development` | Environment |

## Testing

\```bash
./dev test
\```

## Further Reading

Durable architecture and policy live in `docs/` — this README covers only how to run the app.
```
