# Testing

## Testing Philosophy

The frontend shape is the **testing trophy** (Kent Dodds): a thin static-analysis base, a few unit tests, a fat middle of integration tests that render real component trees against a mocked network, and a thin layer of end-to-end checks, plus the front-door proof above it — Playwright against the real running app and real backend. This is the frontend idiom of the framework testing canon (`docs/principles/foundations/testing.md`, including the fake-needs-a-real-test rule: every MSW handler standing in for a real endpoint is a debt some real e2e test must pay) — the backends run the honeycomb, the frontend runs the trophy, both put the weight on integration over isolated units. When this file and the canon disagree, the canon wins and this file is the one to fix.

Tests in the Next.js application follow four rules:

1. **Vitest + React Testing Library** for all component and hook tests
2. **MSW** (Mock Service Worker) for network mocking — never mock `fetch` directly
3. **100% coverage for `lib/utils.ts`** — all pure utility functions are fully tested
4. **Hook isolation** — data-fetching hooks are tested with `renderHook` from `@testing-library/react`

Tests verify behaviour from the user's perspective, not implementation details. Query by accessible roles and text content, not by CSS classes or data-test attributes.

---

## Vitest + React Testing Library

### Setup

```tsx
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    css: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
```

```tsx
// tests/setup.ts
import '@testing-library/jest-dom/vitest';
import { server } from './mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### Component Test Example

```tsx
// components/orders/__tests__/order-card.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OrderCard } from '../order-card';
import { mockOrder } from '@/tests/fixtures/orders';

describe('OrderCard', () => {
  it('renders the order id and status', () => {
    render(<OrderCard order={mockOrder()} />);

    expect(screen.getByRole('heading')).toHaveTextContent(mockOrder().id);
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('calls onSelect when clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(<OrderCard order={mockOrder()} onSelect={onSelect} />);

    await user.click(screen.getByRole('article'));
    expect(onSelect).toHaveBeenCalledWith(mockOrder().id);
  });

  it('shows delete button on hover', async () => {
    const user = userEvent.setup();
    render(<OrderCard order={mockOrder()} />);

    // Action buttons hidden by default
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeVisible();

    // Hover reveals actions
    await user.hover(screen.getByRole('article'));
    expect(screen.getByRole('button', { name: /delete/i })).toBeVisible();
  });
});
```

### Query Priority

Use queries in this priority order (from most to least preferred):

1. `getByRole` — accessible roles (`button`, `heading`, `textbox`, `article`)
2. `getByLabelText` — form elements with associated labels
3. `getByPlaceholderText` — inputs with placeholder text
4. `getByText` — visible text content
5. `getByTestId` — last resort only, when no accessible query is possible

---

## Network Mocking with MSW

Never mock `fetch` directly. Use MSW to intercept network requests at the service worker level, which tests the full fetch pipeline including request construction and response parsing.

### Handler Setup

```tsx
// tests/mocks/handlers.ts
import { http, HttpResponse } from 'msw';
import { mockOrder, mockOrderList } from '../fixtures/orders';

export const handlers = [
  http.get('/v1/orders', () => {
    return HttpResponse.json(mockOrderList());
  }),

  http.get('/v1/orders/:id', ({ params }) => {
    const order = mockOrder({ id: params.id as string });
    return HttpResponse.json(order);
  }),

  http.post('/v1/orders', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(
      mockOrder({ customer_id: body.customer_id }),
      { status: 201 }
    );
  }),

  http.delete('/v1/orders/:id', () => {
    return new HttpResponse(null, { status: 204 });
  }),
];
```

```tsx
// tests/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

### Overriding Handlers Per Test

```tsx
import { server } from '@/tests/mocks/server';
import { http, HttpResponse } from 'msw';

it('shows error state when API fails', async () => {
  // Override the default handler for this test only
  server.use(
    http.get('/v1/orders', () => {
      return HttpResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    })
  );

  render(<OrderDashboard />);

  expect(await screen.findByText(/couldn't load/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
});
```

---

## Hook Testing

SWR data-fetching hooks are tested in isolation using `@testing-library/react-hooks` (now part of `@testing-library/react`).

```tsx
// hooks/__tests__/use-orders.test.tsx
import { renderHook, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { useOrders } from '../use-orders';

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig value={{ dedupingInterval: 0, provider: () => new Map() }}>
      {children}
    </SWRConfig>
  );
}

describe('useOrders', () => {
  it('returns order data', async () => {
    const { result } = renderHook(() => useOrders(), { wrapper });

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    // Wait for data
    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data.data).toHaveLength(3);
    expect(result.current.error).toBeUndefined();
  });

  it('handles API errors', async () => {
    server.use(
      http.get('/v1/orders', () => {
        return HttpResponse.json({ error: 'fail' }, { status: 500 });
      })
    );

    const { result } = renderHook(() => useOrders(), { wrapper });

    await waitFor(() => {
      expect(result.current.error).toBeDefined();
    });
  });
});
```

### Key Points

- Wrap hooks in a fresh `SWRConfig` with `provider: () => new Map()` to prevent cache pollution between tests.
- Set `dedupingInterval: 0` so SWR doesn't deduplicate requests between tests.
- MSW handles the network layer — the hook tests validate the hook's behaviour with real request/response cycles.

---

## Theme Coverage

Every component must be rendered and verified in both dark and light themes. Add theme variants to tests for visual components.

The snapshot below is the deliberate exception to the no-snapshots-by-default rule: snapshots are reserved for genuinely opaque generated artefacts — here, the resolved theme-specific styles — never for ordinary component output.

```tsx
describe('OrderCard', () => {
  const themes = [
    { name: 'light', className: '' },
    { name: 'dark', className: 'dark' },
  ];

  themes.forEach(({ name, className }) => {
    describe(`in ${name} theme`, () => {
      it('renders correctly', () => {
        const { container } = render(
          <div className={className}>
            <OrderCard order={mockOrder()} />
          </div>
        );

        expect(screen.getByText('Pending')).toBeInTheDocument();
        // Snapshot captures theme-specific styles
        expect(container.firstChild).toMatchSnapshot();
      });
    });
  });
});
```

### What to Check

- Text is readable against the background in both themes
- Borders and shadows are visible in both themes
- Glass blur effects don't obscure content
- Status colours (success, error, warning) maintain sufficient contrast

---

## Utility Coverage

`lib/utils.ts` must have 100% test coverage. Every exported function must be tested with representative inputs and edge cases.

```tsx
// lib/__tests__/utils.test.ts
import { cn, formatDuration, formatRelativeTime } from '../utils';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('bg-red', 'text-white')).toBe('bg-red text-white');
  });

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible');
  });

  it('resolves Tailwind conflicts', () => {
    expect(cn('p-4', 'p-6')).toBe('p-6');
  });
});

describe('formatDuration', () => {
  it('formats minutes', () => {
    expect(formatDuration(45)).toBe('45m');
  });

  it('formats hours and minutes', () => {
    expect(formatDuration(90)).toBe('1h 30m');
  });

  it('handles zero', () => {
    expect(formatDuration(0)).toBe('0m');
  });
});
```

---

## Accessibility Testing

Use `jest-axe` to automatically check for common accessibility violations:

```tsx
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

describe('OrderForm', () => {
  it('has no accessibility violations', async () => {
    const { container } = render(<OrderForm />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

### What axe Catches

- Missing `aria-label` on icon-only buttons
- Form inputs without associated labels
- Insufficient colour contrast
- Missing landmark roles
- Invalid ARIA attributes

Run axe tests on every component that renders interactive elements or requires accessibility compliance.

---

## Component Testing Patterns

### Test Fixtures

Create reusable fixtures for test data:

```tsx
// tests/fixtures/orders.ts
import type { Order, OrderList } from '@/lib/schemas';

export function mockOrder(overrides?: Partial<Order>): Order {
  return {
    id: 'order-001',
    status: 'pending',
    customer_id: 'user-001',
    quantity: 2,
    note: null,
    created_at: '2026-04-10T08:00:00Z',
    updated_at: '2026-04-10T08:00:00Z',
    ...overrides,
  };
}

export function mockOrderList(count = 3): OrderList {
  return {
    data: Array.from({ length: count }, (_, i) =>
      mockOrder({ id: `order-${String(i + 1).padStart(3, '0')}` })
    ),
    pagination: { next_cursor: null, has_more: false },
  };
}
```

### Testing Server Actions

Server Actions cannot be called directly in test environments. Test the client-side consumption pattern instead:

```tsx
// Test that the form correctly handles the ActionResult
it('shows error message on server failure', async () => {
  vi.mock('@/app/actions/order-actions', () => ({
    createOrderAction: vi.fn().mockResolvedValue({
      data: null,
      error: 'Customer not found',
    }),
  }));

  const user = userEvent.setup();
  render(<OrderForm />);

  await user.type(screen.getByLabelText(/customer/i), 'unknown-customer');
  await user.click(screen.getByRole('button', { name: /create/i }));

  expect(await screen.findByText('Customer not found')).toBeInTheDocument();
  // Input preserved — not cleared on error
  expect(screen.getByLabelText(/customer/i)).toHaveValue('unknown-customer');
});
```

---

## Trace Assertions

Observability is a test surface (canon principle 3). The app ships OpenTelemetry through `instrumentation.ts`, so server-side work — route handlers and Server Actions — emits spans; assert on a new server path with an **in-memory span exporter** rather than trusting the instrumentation silently. Server-side only — component and hook tests assert on rendered behaviour, not traces.

```ts
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';

const exporter = new InMemorySpanExporter();
const provider = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });
provider.register();

// invoke the route handler / server action, then:
const names = exporter.getFinishedSpans().map((s) => s.name);
expect(names).toContain('POST /v1/orders'); // the entry span exists, trace connected
```

Assert what the contract promises, not the whole span tree (canon principle 3: pinning couples the test to implementation).

## Mutation Testing — the assertion-quality read-out

Mutation testing is the assertion-quality read-out (canon principle 5): a **signal, never a gate**. Coverage tells you a line ran, not that an assertion checked it — a 100% covered `lib/utils.ts` can still assert nothing. **StrykerJS** mutates the code and confirms a test fails; run it incrementally on changed code (`stryker run --incremental`, which diffs against the cached `reports/stryker-incremental.json` — there is no `--since` flag). Point it at the dense pure logic first (`lib/utils.ts`, schema validators, formatters); a surviving mutant there is the missing assertion to add — the same read-out is the antidote to AI-generated component tests, whose oracle is lifted from the current markup.

## Generate the Inputs You Can't Enumerate

The bugs live in the cases you didn't enumerate (canon principle 7). Two generative surfaces apply to a Next.js app:

- **Property-based tests with `fast-check`** for the dense pure logic — formatters, `lib/utils.ts`, Zod-adjacent transforms, anything with an invariant (a round-trip, a sort that must stay stable, a parse that must never throw). State the property; fast-check generates and shrinks counterexamples. This is the highest-leverage complement to example-based unit tests: one property covers an infinity of inputs.

```ts
import fc from 'fast-check';

it('formatDuration never throws and always ends in m', () => {
  fc.assert(
    fc.property(fc.nat({ max: 100_000 }), (minutes) => {
      const out = formatDuration(minutes);
      expect(out).toMatch(/m$/);
    }),
  );
});
```

- **Schemathesis at the API boundary.** Route handlers backed by an OpenAPI schema are the bridge between contract testing and property fuzzing: point Schemathesis at the spec and it derives a semantics-aware fuzzer that finds materially more defects than example-based API tests for the cost of pointing it at the schema. Run it against the app's route handlers (`/api/*`) in a dedicated lane, not on every component PR.

Reach for these where invariants are real. Presentational components have no invariant to state — test them with example-based RTL renders.

## Naming Tests by Behaviour

Canon principle 4: name by behaviour and condition, not implementation. `renders correctly` and `works` say nothing the dashboard doesn't already show; `shows the retry button when the orders request fails` does.

## Test Commands

| Command | Purpose |
|---------|---------|
| `pnpm test` | Run all tests |
| `pnpm test -- --watch` | Watch mode |
| `pnpm test -- --coverage` | Generate coverage report |
| `pnpm test -- order-card` | Run tests matching pattern |
| `pnpm test -- --reporter=verbose` | Verbose output |

## Bet Slice Rollout — the permanent tests a slice owes

When a bet slice's progress tests go green, the slice-worker rolls out permanent coverage as part of the same slice, before the driver reviews it (bet workflow, Delivery). The bet-progress tests prove the capability once and are archived; these stay.

- **Interface test (always).** One Playwright test per user-observable behaviour the slice delivered, using the page objects under `tests/system/pages/` — selectors live in the page object, assertions in the test.
- **Component tests (when state earned them).** Components the slice introduced with conditional rendering, optimistic updates, or error states get component-level tests; purely presentational markup does not.
- **Accessibility coverage (when the slice added a surface).** A new screen or interactive flow extends the a11y smoke — axe scan clean and keyboard path exercised — because regressions here are invisible to every other test type.
- **Server action / route tests (when the slice added them).** Server actions and route handlers the slice introduced get request-level tests with Zod schema failures exercised, not just the happy path.
- **Critical-path trace assertions (when the slice added an instrumented server path).** A route handler or Server Action whose trace a dashboard or SLO depends on pins it with an in-memory-exporter test: the entry span exists and the trace stays connected. A missing span is a test failure, not an instrumentation TODO.
