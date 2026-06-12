# Data Fetching

## Table of Contents
- [Decision Tree](#decision-tree)
- [Server Component Fetching](#server-component-fetching)
- [SWR Hook Pattern](#swr-hook-pattern)
- [Hydration Seeding](#hydration-seeding)
- [Avoiding Data Waterfalls](#avoiding-data-waterfalls)
- [Optimistic UI](#optimistic-ui)
- [Route Handlers](#route-handlers)
- [Client Component Data Fetching](#client-component-data-fetching)
- [The API Client Layer](#the-api-client-layer)

---

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

The rule: **never use `useEffect` for data fetching** in the the Next.js application. All client-side data fetching goes through SWR, which provides caching, deduplication, revalidation, and focus-aware refetching out of the box.

---

## Server Component Fetching

Server Components can fetch data directly — no API route, no SWR hook, no loading state. The data is available before the component renders.

```tsx
// app/meetings/page.tsx
import { getMeetings } from '@/lib/api';
import { MeetingList } from '@/components/meetings';

export default async function MeetingsPage() {
  const meetings = await getMeetings();
  return <MeetingList meetings={meetings} />;
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
// hooks/use-meetings.ts
'use client';

import useSWR from 'swr';
import { getMeetings, getMeeting } from '@/lib/api';
import type { Meeting, MeetingList } from '@/lib/schemas';

export function useMeetings() {
  return useSWR<MeetingList>('/api/meetings', getMeetings);
}

export function useMeeting(id: string) {
  return useSWR<Meeting>(
    id ? `/api/meetings/${id}` : null,
    () => getMeeting(id)
  );
}
```

### Usage in Client Components

```tsx
'use client';

import { useMeetings } from '@/hooks/use-meetings';

export function MeetingDashboard() {
  const { data, error, isLoading } = useMeetings();

  if (isLoading) return <MeetingListSkeleton />;
  if (error) return <ErrorState message="Failed to load meetings" />;

  return (
    <ul>
      {data.data.map(meeting => (
        <li key={meeting.id}>{meeting.title}</li>
      ))}
    </ul>
  );
}
```

### SWR Configuration

SWR is configured globally in the root layout or a provider component:

```tsx
// lib/contexts.tsx
'use client';

import { SWRConfig } from 'swr';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        dedupingInterval: 2000,
        errorRetryCount: 3,
      }}
    >
      {children}
    </SWRConfig>
  );
}
```

---

## Hydration Seeding

Seed client-side SWR hooks by wrapping Server Components in `<SWRConfig value={{ fallback }}>`. This eliminates the flash of loading state on the client — the SWR hook immediately has data to render.

```tsx
// app/meetings/page.tsx — Server Component
import { SWRConfig } from 'swr';
import { getMeetings } from '@/lib/api';
import { MeetingDashboard } from '@/components/meetings';

export default async function MeetingsPage() {
  // Fetch on the server
  const meetings = await getMeetings();

  // Seed the SWR cache with server-fetched data
  return (
    <SWRConfig value={{ fallback: { '/api/meetings': meetings } }}>
      <MeetingDashboard />
    </SWRConfig>
  );
}
```

```tsx
// components/meetings/meeting-dashboard.tsx — Client Component
'use client';

import { useMeetings } from '@/hooks/use-meetings';

export function MeetingDashboard() {
  // SWR immediately returns the seeded data — no loading flash
  const { data, mutate } = useMeetings();

  // data is available on first render because of the fallback
  return <MeetingList meetings={data.data} />;
}
```

The SWR cache key in the `fallback` object must exactly match the key used in the `useSWR` call. If the hook uses `/api/meetings`, the fallback key must be `/api/meetings`.

---

## Avoiding Data Waterfalls

Sequential fetches create waterfalls — each request waits for the previous one to complete. Three strategies prevent this.

### Strategy 1: Parallel Fetching with Promise.all

When a component needs multiple independent datasets, fetch them in parallel:

```tsx
// Bad — sequential waterfalls
async function DashboardPage() {
  const meetings = await getMeetings();    // Wait...
  const users = await getUsers();          // Then wait...
  const analytics = await getAnalytics();  // Then wait...
  return <Dashboard meetings={meetings} users={users} analytics={analytics} />;
}

// Good — parallel fetching
async function DashboardPage() {
  const [meetings, users, analytics] = await Promise.all([
    getMeetings(),
    getUsers(),
    getAnalytics(),
  ]);
  return <Dashboard meetings={meetings} users={users} analytics={analytics} />;
}
```

### Strategy 2: Streaming with Suspense

Let each section load independently. Fast sections render immediately; slow sections show a skeleton and stream in when ready.

```tsx
import { Suspense } from 'react';

async function DashboardPage() {
  return (
    <div>
      <Suspense fallback={<MeetingsSkeleton />}>
        <MeetingsSection />
      </Suspense>
      <Suspense fallback={<AnalyticsSkeleton />}>
        <AnalyticsSection />
      </Suspense>
    </div>
  );
}

// Each section fetches independently
async function MeetingsSection() {
  const meetings = await getMeetings();
  return <MeetingList meetings={meetings} />;
}

async function AnalyticsSection() {
  const analytics = await getAnalytics();
  return <AnalyticsChart data={analytics} />;
}
```

### Strategy 3: Preload Pattern

Start fetching early, then consume the result later when the data is needed:

```tsx
import { cache } from 'react';

// React.cache deduplicates — multiple calls with the same args return the same promise
export const getMeeting = cache(async (id: string) => {
  return await fetchMeetingFromApi(id);
});

export const preloadMeeting = (id: string) => {
  void getMeeting(id);  // Fire and forget — starts the fetch
};
```

```tsx
export default async function MeetingPage({ params }: Props) {
  const { id } = await params;

  preloadMeeting(id);   // Start fetching immediately

  // ... other work ...

  const meeting = await getMeeting(id);  // Data likely ready by now
  return <MeetingDetail meeting={meeting} />;
}
```

---

## Optimistic UI

When a user triggers an action, immediately update the local SWR cache using `mutate()` before receiving server confirmation. Revert if the Server Action returns an error.

```tsx
'use client';

import { useMeetings } from '@/hooks/use-meetings';
import { deleteMeetingAction } from '@/app/actions/meeting-actions';
import { useSWRConfig } from 'swr';

export function MeetingCard({ meeting }: { meeting: Meeting }) {
  const { mutate } = useSWRConfig();

  async function handleDelete() {
    // 1. Optimistically remove from the UI
    mutate(
      '/api/meetings',
      (current: MeetingList | undefined) => {
        if (!current) return current;
        return {
          ...current,
          data: current.data.filter(m => m.id !== meeting.id),
        };
      },
      { revalidate: false }  // Don't refetch yet
    );

    // 2. Perform the actual deletion
    const result = await deleteMeetingAction(meeting.id);

    if (result.error) {
      // 3. Revert on failure — refetch the real data
      mutate('/api/meetings');
      toast.error(result.error);
    }
  }

  return (
    <article>
      <h2>{meeting.title}</h2>
      <button onClick={handleDelete}>Delete</button>
    </article>
  );
}
```

This makes the UI feel instant. The user sees the meeting disappear immediately. If the server fails, the meeting reappears with an error toast.

---

## Route Handlers

Route Handlers (`route.ts`) create API endpoints. Use them when you need an HTTP endpoint for external consumers — not for internal data fetching.

### When to Use Route Handlers

| Use Case | Route Handler | Server Component | Server Action |
|----------|:---:|:---:|:---:|
| Internal page data | | ✅ | |
| Client-side reads (SWR) | ✅ | | |
| Form mutations | | | ✅ |
| External API (mobile, third party) | ✅ | | |
| Webhooks from external services | ✅ | | |
| Cacheable GET endpoints | ✅ | | |

### Basic Route Handler

```tsx
// app/api/meetings/route.ts
import { NextRequest } from 'next/server';
import { getMeetings } from '@/lib/api';

export async function GET(request: NextRequest) {
  const meetings = await getMeetings();
  return Response.json(meetings);
}
```

### Environment

Route Handlers run in a server-only environment. They can use `async/await`, `cookies()`, `headers()`, and Node.js APIs. They **cannot** use React hooks, React DOM APIs, or browser APIs. Do not attempt to render React components inside a route handler.

### Conflict Rule

A `route.ts` and `page.tsx` cannot coexist in the same folder. Separate API routes from page routes:

```
app/
├── meetings/
│   └── page.tsx            # /meetings (page)
└── api/
    └── meetings/
        └── route.ts        # /api/meetings (API)
```

---

## Client Component Data Fetching

When a Client Component needs data, prefer passing it from a parent Server Component. Direct client-side fetching is the fallback.

### Option 1: Pass from Server Component (Preferred)

```tsx
// Server Component — fetches data
async function Page() {
  const data = await fetchData();
  return <ClientComponent initialData={data} />;
}

// Client Component — receives pre-fetched data
'use client';
function ClientComponent({ initialData }: { initialData: Data }) {
  const [data, setData] = useState(initialData);
  // Interactive logic using pre-loaded data
}
```

### Option 2: SWR Hook (When Data Must Refresh)

```tsx
'use client';
import { useMeetings } from '@/hooks/use-meetings';

function MeetingDashboard() {
  const { data, error, isLoading } = useMeetings();
  if (isLoading) return <Skeleton />;
  return <MeetingList meetings={data.data} />;
}
```

### Never: useEffect + fetch

```tsx
// ❌ Forbidden in the Next.js application
'use client';
function MeetingDashboard() {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch('/api/meetings').then(r => r.json()).then(setData);
  }, []);
}
```

---

## The API Client Layer

`lib/api.ts` contains one function per Go REST endpoint. It depends only on schemas.

```tsx
// lib/api.ts
import { meetingSchema, meetingListSchema, type Meeting, type MeetingList } from '@/lib/schemas';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

export async function getMeetings(): Promise<MeetingList> {
  const res = await fetch(`${API_BASE}/v1/meetings`);
  if (!res.ok) throw new Error(`Failed to fetch meetings: ${res.status}`);
  const json = await res.json();
  return meetingListSchema.parse(json);
}

export async function getMeeting(id: string): Promise<Meeting> {
  const res = await fetch(`${API_BASE}/v1/meetings/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch meeting: ${res.status}`);
  const json = await res.json();
  return meetingSchema.parse(json);
}

export async function createMeeting(data: CreateMeetingInput): Promise<Meeting> {
  const res = await fetch(`${API_BASE}/v1/meetings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to create meeting: ${res.status}`);
  const json = await res.json();
  return meetingSchema.parse(json);
}
```

Every response is parsed through a Zod schema. If the Go backend changes a field name or adds a required field, the parse call throws immediately with a clear error — not a silent runtime bug three layers up.
