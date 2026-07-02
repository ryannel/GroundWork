# Architecture & File Structure

## Dependency Graph

The Next.js application enforces a strict inward-facing dependency graph. Every import must point **downward** in this hierarchy — never upward or sideways.

```
┌─────────────────────────────────────────────────┐
│  Pages (app/)                                    │
│  Thin route shells — delegate immediately        │
└──────────────────────┬──────────────────────────┘
                       │ imports
┌──────────────────────▼──────────────────────────┐
│  Features (components/<domain>/)                 │
│  Domain-specific UI — compose from everything    │
│  below                                           │
└──────────────────────┬──────────────────────────┘
                       │ imports
┌──────────────────────▼──────────────────────────┐
│  UI Primitives (components/ui/)                  │
│  shadcn/ui — never edit, update via CLI          │
├──────────────────────┬──────────────────────────┤
│  Contexts (lib/contexts.tsx)                     │
│  Cross-cutting client state — no UI imports      │
├──────────────────────┬──────────────────────────┤
│  Hooks (hooks/)                                  │
│  SWR fetching + utilities                        │
└──────────────────────┬──────────────────────────┘
                       │ imports
┌──────────────────────▼──────────────────────────┐
│  API Client (lib/api.ts)                         │
│  One function per Go REST endpoint               │
├──────────────────────┬──────────────────────────┤
│  Utilities (lib/utils.ts)                        │
│  Pure functions — zero internal dependencies     │
└──────────────────────┬──────────────────────────┘
                       │ imports
┌──────────────────────▼──────────────────────────┐
│  Schemas (lib/schemas/)                          │
│  Zod schemas + z.infer types — ZERO dependencies │
└─────────────────────────────────────────────────┘
```

### Allowed Import Relationships

| Layer | Can Import | Cannot Import |
|-------|-----------|---------------|
| **Schemas** | Standard library only | Everything else |
| **API Client** | Schemas | Hooks, Components, Contexts |
| **Utilities** | Standard library only | Everything else |
| **Hooks** | API Client, Schemas | Components, Contexts |
| **Contexts** | Schemas, Utilities | Components (any) |
| **UI Primitives** | Utilities | Features, Pages, Hooks, Contexts, API Client |
| **Features** | Primitives, Hooks, Contexts, Utilities, Schemas | Pages, other Features (unless explicitly composed) |
| **Pages** | Features, Contexts | Direct use of Hooks, API Client (delegate to features) |

When a page needs data, it fetches in a Server Component and passes serialised props to feature components. Pages are thin wrappers — they never contain business logic, complex layouts, or conditional rendering beyond route-level decisions.

---

## Directory Layout

```
the Next.js application/
├── app/                              # PAGES — Route definitions
│   ├── layout.tsx                    # Root layout (required)
│   ├── page.tsx                      # Home page (/)
│   ├── loading.tsx                   # Root loading UI
│   ├── error.tsx                     # Root error boundary
│   ├── not-found.tsx                 # Root 404
│   ├── global-error.tsx              # Catches root layout errors
│   ├── globals.css                   # Tailwind v4 config (@theme, tokens)
│   ├── (auth)/                       # Route group (no URL impact)
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   ├── dashboard/
│   │   ├── page.tsx                  # /dashboard
│   │   ├── loading.tsx               # Dashboard-specific loading
│   │   └── [id]/
│   │       └── page.tsx              # /dashboard/:id
│   └── api/                          # Route Handlers (REST endpoints)
│       └── health/
│           └── route.ts              # /api/health
│
├── components/
│   ├── ui/                           # UI PRIMITIVES — shadcn/ui (do not edit)
│   │   ├── button.tsx
│   │   ├── dialog.tsx
│   │   └── ...
│   └── orders/                       # FEATURES — domain-specific
│       ├── order-card.tsx
│       ├── order-list.tsx
│       ├── order-form.tsx
│       └── index.ts                  # Barrel export
│
├── hooks/                            # HOOKS — SWR + utilities
│   ├── use-orders.ts
│   ├── use-auth.ts
│   └── use-theme.ts
│
├── lib/                              # SHARED LOGIC
│   ├── schemas/                      # SCHEMAS — Zod definitions
│   │   ├── order.ts
│   │   ├── user.ts
│   │   └── index.ts                  # Barrel export
│   ├── api.ts                        # API CLIENT — one fn per endpoint
│   ├── utils.ts                      # UTILITIES — pure functions
│   └── contexts.tsx                  # CONTEXTS — cross-cutting state
│
├── proxy.ts                          # Proxy (Next.js 16 — replaces middleware.ts)
├── postcss.config.js                 # @tailwindcss/postcss
└── next.config.ts
```

Route structure and the special-file table (`page.tsx`, `layout.tsx`, `error.tsx`, …) live in `references/routing-and-navigation.md` — this file owns the dependency graph and directory shape, not route mechanics.

---

## File Naming Rules

Every file and directory uses `kebab-case`. This is enforced without exception.

```
# Correct
components/orders/order-card.tsx
hooks/use-order-list.ts
lib/schemas/order-summary.ts

# Incorrect — will be rejected
components/orders/OrderCard.tsx        # PascalCase file
hooks/useOrderList.ts                  # camelCase file
lib/schemas/OrderSummary.ts            # PascalCase file
```

Exported React components use PascalCase names despite their kebab-case filenames:

```tsx
// File: components/orders/order-card.tsx
export function OrderCard({ order }: OrderCardProps) {
  return <article>...</article>;
}
```

---

## Barrel Exports

Every domain-specific folder must include an `index.ts` that re-exports its public API. This keeps imports clean and establishes clear module boundaries.

```tsx
// components/orders/index.ts
export { OrderCard } from './order-card';
export { OrderList } from './order-list';
export { OrderForm } from './order-form';

// lib/schemas/index.ts
export { orderSchema, type Order } from './order';
export { userSchema, type User } from './user';
```

Consuming code imports from the barrel, not from individual files:

```tsx
// Good — import from barrel
import { OrderCard, OrderList } from '@/components/orders';
import { orderSchema, type Order } from '@/lib/schemas';

// Bad — import from individual files
import { OrderCard } from '@/components/orders/order-card';
```

---

## Component Decomposition

Any component exceeding approximately **150 lines** must be broken down into smaller, composable units. This threshold is a guideline, not a hard line count — the goal is components that do one thing well.

### When to Split

- The component renders multiple distinct visual sections
- It manages multiple independent pieces of state
- It contains conditional rendering for different modes (view/edit/loading/error)
- It has complex event handling for unrelated interactions

### How to Split

Extract sub-components into the same domain folder. Co-located files share the same barrel export:

```
components/orders/
├── order-detail.tsx          # Parent — orchestrates layout
├── order-header.tsx          # Sub-component — status, metadata
├── order-items.tsx           # Sub-component — line-item table
├── order-actions.tsx         # Sub-component — action buttons
└── index.ts                  # Exports OrderDetail (and sub-components if needed)
```

---

## shadcn/ui Primitives

The `components/ui/` directory contains shadcn/ui components. These are generated — never manually edited.

### Adding or Updating

```bash
pnpm dlx shadcn@latest add button
pnpm dlx shadcn@latest add dialog
```

### Customisation

If a shadcn/ui component needs customisation for the project, create a wrapper in the appropriate feature folder — do not modify the source in `components/ui/`:

```tsx
// components/orders/order-dialog.tsx — wrapper with domain-specific behaviour
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';

export function OrderDialog({ children, title }: OrderDialogProps) {
  return (
    <Dialog>
      <DialogContent className="surface-elevated">
        <DialogHeader>{title}</DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
```

---

## Import Validation

Before adding an import, ask:

> "Does this import point downward (toward Schemas) or upward (toward Pages)?"

If it points upward, the design needs to change. Common fixes:

| Problem | Fix |
|---------|-----|
| Hook needs a component | Extract the shared logic into a utility or context |
| Page contains business logic | Move it to a feature component |
| Feature needs data | Create a hook, don't call lib/api.ts directly from client code |
| Schema imports a hook | Move the derived logic out of the schema file |
| Context imports a component | Separate state logic from rendering |
