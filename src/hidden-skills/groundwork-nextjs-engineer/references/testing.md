# Testing

## Table of Contents
- [Testing Philosophy](#testing-philosophy)
- [Vitest + React Testing Library](#vitest--react-testing-library)
- [Network Mocking with MSW](#network-mocking-with-msw)
- [Hook Testing](#hook-testing)
- [Theme Coverage](#theme-coverage)
- [Utility Coverage](#utility-coverage)
- [Accessibility Testing](#accessibility-testing)
- [Component Testing Patterns](#component-testing-patterns)
- [Test Commands](#test-commands)

---

## Testing Philosophy

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
// components/meetings/__tests__/meeting-card.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MeetingCard } from '../meeting-card';
import { mockMeeting } from '@/tests/fixtures/meetings';

describe('MeetingCard', () => {
  it('renders the meeting title and status', () => {
    render(<MeetingCard meeting={mockMeeting()} />);

    expect(screen.getByRole('heading')).toHaveTextContent('Sprint Planning');
    expect(screen.getByText('Scheduled')).toBeInTheDocument();
  });

  it('calls onSelect when clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(<MeetingCard meeting={mockMeeting()} onSelect={onSelect} />);

    await user.click(screen.getByRole('article'));
    expect(onSelect).toHaveBeenCalledWith(mockMeeting().id);
  });

  it('shows delete button on hover', async () => {
    const user = userEvent.setup();
    render(<MeetingCard meeting={mockMeeting()} />);

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
import { mockMeeting, mockMeetingList } from '../fixtures/meetings';

export const handlers = [
  http.get('/v1/meetings', () => {
    return HttpResponse.json(mockMeetingList());
  }),

  http.get('/v1/meetings/:id', ({ params }) => {
    const meeting = mockMeeting({ id: params.id as string });
    return HttpResponse.json(meeting);
  }),

  http.post('/v1/meetings', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(
      mockMeeting({ title: body.title }),
      { status: 201 }
    );
  }),

  http.delete('/v1/meetings/:id', () => {
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
    http.get('/v1/meetings', () => {
      return HttpResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    })
  );

  render(<MeetingDashboard />);

  expect(await screen.findByText(/couldn't load/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
});
```

---

## Hook Testing

SWR data-fetching hooks are tested in isolation using `@testing-library/react-hooks` (now part of `@testing-library/react`).

```tsx
// hooks/__tests__/use-meetings.test.tsx
import { renderHook, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { useMeetings } from '../use-meetings';

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig value={{ dedupingInterval: 0, provider: () => new Map() }}>
      {children}
    </SWRConfig>
  );
}

describe('useMeetings', () => {
  it('returns meeting data', async () => {
    const { result } = renderHook(() => useMeetings(), { wrapper });

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
      http.get('/v1/meetings', () => {
        return HttpResponse.json({ error: 'fail' }, { status: 500 });
      })
    );

    const { result } = renderHook(() => useMeetings(), { wrapper });

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
describe('MeetingCard', () => {
  const themes = [
    { name: 'light', className: '' },
    { name: 'dark', className: 'dark' },
  ];

  themes.forEach(({ name, className }) => {
    describe(`in ${name} theme`, () => {
      it('renders correctly', () => {
        const { container } = render(
          <div className={className}>
            <MeetingCard meeting={mockMeeting()} />
          </div>
        );

        expect(screen.getByRole('heading')).toHaveTextContent('Sprint Planning');
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

describe('MeetingForm', () => {
  it('has no accessibility violations', async () => {
    const { container } = render(<MeetingForm />);
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
// tests/fixtures/meetings.ts
import type { Meeting, MeetingList } from '@/lib/schemas';

export function mockMeeting(overrides?: Partial<Meeting>): Meeting {
  return {
    id: 'meeting-001',
    title: 'Sprint Planning',
    status: 'scheduled',
    host_id: 'user-001',
    starts_at: '2026-04-15T10:00:00Z',
    duration_minutes: 30,
    created_at: '2026-04-10T08:00:00Z',
    updated_at: '2026-04-10T08:00:00Z',
    ...overrides,
  };
}

export function mockMeetingList(count = 3): MeetingList {
  return {
    data: Array.from({ length: count }, (_, i) =>
      mockMeeting({ id: `meeting-${String(i + 1).padStart(3, '0')}` })
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
  vi.mock('@/app/actions/meeting-actions', () => ({
    createMeetingAction: vi.fn().mockResolvedValue({
      data: null,
      error: 'Title already exists',
    }),
  }));

  const user = userEvent.setup();
  render(<MeetingForm />);

  await user.type(screen.getByLabelText(/title/i), 'Existing Meeting');
  await user.click(screen.getByRole('button', { name: /create/i }));

  expect(await screen.findByText('Title already exists')).toBeInTheDocument();
  // Input preserved — not cleared on error
  expect(screen.getByLabelText(/title/i)).toHaveValue('Existing Meeting');
});
```

---

## Test Commands

| Command | Purpose |
|---------|---------|
| `pnpm test` | Run all tests |
| `pnpm test -- --watch` | Watch mode |
| `pnpm test -- --coverage` | Generate coverage report |
| `pnpm test -- meeting-card` | Run tests matching pattern |
| `pnpm test -- --reporter=verbose` | Verbose output |

## Bet Slice Rollout — the permanent tests a slice owes

When a bet slice's progress tests go green, the slice rolls out permanent coverage before it closes (bet workflow, Delivery step 5). The bet-progress tests prove the capability once and are archived; these stay.

- **Interface test (always).** One Playwright test per user-observable behaviour the slice delivered, using the page objects under `tests/system/pages/` — selectors live in the page object, assertions in the test.
- **Component tests (when state earned them).** Components the slice introduced with conditional rendering, optimistic updates, or error states get component-level tests; purely presentational markup does not.
- **Accessibility coverage (when the slice added a surface).** A new screen or interactive flow extends the a11y smoke — axe scan clean and keyboard path exercised — because regressions here are invisible to every other test type.
- **Server action / route tests (when the slice added them).** Server actions and route handlers the slice introduced get request-level tests with Zod schema failures exercised, not just the happy path.
