# Server Components & Client Boundaries

## Table of Contents
- [RSC by Default](#rsc-by-default)
- [When to Add use client](#when-to-add-use-client)
- [Async Params and SearchParams](#async-params-and-searchparams)
- [Async Server Functions](#async-server-functions)
- [Additional Server Functions](#additional-server-functions)
- [Directives](#directives)
- [Runtime Selection](#runtime-selection)
- [Patterns for Crossing the Boundary](#patterns-for-crossing-the-boundary)

---

## RSC by Default

Every component in the the Next.js application is a React Server Component unless explicitly marked otherwise. Server Components run on the server, have zero client-side JavaScript overhead, and can directly fetch data, read cookies, and access server-only resources.

Add the `"use client"` directive only when the component strictly requires:
- React hooks (`useState`, `useEffect`, `useRef`, `useContext`, etc.)
- Event handlers (`onClick`, `onChange`, `onSubmit`)
- Browser APIs (`window`, `localStorage`, `IntersectionObserver`)
- Third-party libraries that rely on browser APIs

If a component only needs interactivity in a small subtree, keep the parent as a Server Component and push the `"use client"` boundary as far down the tree as possible.

```tsx
// Server Component (default) — no directive needed
export default async function MeetingPage({ params }: Props) {
  const { id } = await params;
  const meeting = await getMeeting(id);

  return (
    <article>
      <h1>{meeting.title}</h1>
      <MeetingStatus status={meeting.status} />  {/* Server Component */}
      <TranscriptPlayer meetingId={id} />         {/* Client Component — needs audio API */}
    </article>
  );
}

// Only the leaf that needs interactivity is a client component
// components/meetings/transcript-player.tsx
'use client';

import { useState, useRef } from 'react';

export function TranscriptPlayer({ meetingId }: { meetingId: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  // Browser API usage justified
  return <audio ref={audioRef}>...</audio>;
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
| Async data fetch | `await getMeeting(id)` | **No** — Server Components can be async |
| Static rendering | Displaying data, formatting | **No** |
| Reading `cookies()`, `headers()` | Auth checks, locale | **No** — server functions |

---

## Async Params and SearchParams

In Next.js 15+, `params` and `searchParams` are **asynchronous**. They must be typed as `Promise<...>` and awaited before use.

### Pages and Layouts

```tsx
type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ query?: string; tab?: string }>;
};

export default async function MeetingPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { query, tab } = await searchParams;

  const meeting = await getMeeting(id);
  return <MeetingDetail meeting={meeting} activeTab={tab} />;
}
```

### Route Handlers

```tsx
// app/api/meetings/[id]/route.ts
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const meeting = await getMeeting(id);

  if (!meeting) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  return Response.json(meeting);
}
```

### generateMetadata

```tsx
type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const meeting = await getMeeting(id);
  return {
    title: meeting.title,
    description: `Meeting details for ${meeting.title}`,
  };
}
```

### Synchronous Components

When a component cannot be async (e.g., because it also uses hooks), use `React.use()` to unwrap the promise:

```tsx
'use client';

import { use } from 'react';

type Props = { params: Promise<{ id: string }> };

export default function MeetingPage({ params }: Props) {
  const { id } = use(params);
  // Can now use hooks alongside params
  const { data } = useMeeting(id);
  return <div>{data?.title}</div>;
}
```

---

## Async Server Functions

`cookies()` and `headers()` are asynchronous in Next.js 15+. Always `await` them.

```tsx
import { cookies, headers } from 'next/headers';

export default async function Page() {
  const cookieStore = await cookies();
  const headersList = await headers();

  const theme = cookieStore.get('theme')?.value ?? 'obsidian';
  const userAgent = headersList.get('user-agent');

  return <Dashboard theme={theme} />;
}
```

### Migration

If upgrading from an older codebase where these were synchronous, run the codemod:

```bash
pnpx @next/codemod@latest next-async-request-api .
```

---

## Additional Server Functions

| Function | Purpose |
|----------|---------|
| `draftMode()` | Enable preview of unpublished CMS content — sets a cookie that opts into dynamic rendering |
| `connection()` | Wait for the incoming connection before dynamic rendering — use when a component depends on request-time data but doesn't call `cookies()`/`headers()` |
| `userAgent()` | Parse the `User-Agent` header into structured data (`isBot`, `browser`, `device`, `engine`, `os`, `cpu`) |

```tsx
import { draftMode } from 'next/headers';

export default async function Page() {
  const { isEnabled } = await draftMode();

  return isEnabled
    ? <PreviewContent />
    : <PublishedContent />;
}
```

```tsx
import { connection } from 'next/server';

export default async function DynamicWidget() {
  await connection();  // Signals this component needs request-time data
  const data = await getPersonalisedData();
  return <Widget data={data} />;
}
```

```tsx
import { userAgent } from 'next/server';
import { headers } from 'next/headers';

export default async function Page() {
  const headersList = await headers();
  const { isBot, browser, device } = userAgent({ headers: headersList });

  if (isBot) return <BotView />;
  return <UserView browser={browser.name} device={device.type} />;
}
```

---

## Directives

### `'use client'`

Marks a file as a Client Component boundary. Everything imported by this file also becomes part of the client bundle.

```tsx
'use client';

import { useState } from 'react';

export function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

Place the directive at the very top of the file, before any imports. It applies to the entire file — not individual functions.

### `'use server'`

Marks functions as Server Actions. Server Actions are the only functions that can be passed from Server Components to Client Components as props.

```tsx
// File-level — all exports are Server Actions
'use server';

export async function createMeeting(formData: FormData) {
  // Runs on the server
}

export async function deleteMeeting(id: string) {
  // Runs on the server
}
```

```tsx
// Inline — within a Server Component
export default function MeetingPage() {
  async function handleDelete(id: string) {
    'use server';
    await deleteMeeting(id);
    revalidatePath('/meetings');
  }

  return <DeleteButton onDelete={handleDelete} />;
}
```

### `'use cache'`

Caches a function or component result. Part of Next.js Cache Components.

```tsx
'use cache';

export async function getCachedMeetings() {
  return await fetchMeetings();
}
```

Requires `cacheComponents: true` in `next.config.ts`. Use `cacheLife()` and `cacheTag()` to control cache duration and invalidation.

---

## Runtime Selection

Default to the **Node.js runtime** for all routes and pages. Only use Edge runtime if the project already uses it or there is a specific geographic latency requirement.

```tsx
// Default — no config needed (uses Node.js)
export default function Page() { ... }

// Only if there's a specific edge requirement
export const runtime = 'edge';
```

### Decision Checklist

Before adding `runtime = 'edge'`:

1. Does the project already use Edge runtime for other routes?
2. Is there a documented latency requirement that Node.js cannot meet?
3. Are all dependencies of this route Edge-compatible? (No `fs`, limited `crypto`, many npm packages won't work)

If the answer to all three is not clearly "yes", use Node.js.

| Feature | Node.js | Edge |
|---------|---------|------|
| Full Node.js API | Yes | No |
| File system (`fs`) | Yes | No |
| Full `crypto` | Yes | Limited |
| Database connections | Yes | Limited |
| npm package compatibility | Most | Few |
| Cold start | Larger | Smaller |
| Geographic distribution | No | Yes |

---

## Patterns for Crossing the Boundary

### Pattern 1: Server Parent, Client Leaf

The most common pattern. Server Component fetches data and passes serialised props to a client component that adds interactivity.

```tsx
// Server Component — fetches and coordinates
export default async function MeetingsPage() {
  const meetings = await getMeetings();

  return (
    <div>
      <h1>Meetings</h1>
      <MeetingFilters />        {/* Client — needs useState for filter state */}
      <MeetingList meetings={meetings} />  {/* Could be server or client */}
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
      <MeetingList />  {/* This remains a Server Component */}
    </CollapsibleSection>
  );
}
```

### Pattern 3: Hydration Seeding

Fetch data on the server in a Server Component and seed the client-side SWR cache so the client component renders immediately without a loading state.

```tsx
// Server Component — seeds the cache
import { SWRConfig } from 'swr';
import { getMeetings } from '@/lib/api';

export default async function MeetingsPage() {
  const meetings = await getMeetings();

  return (
    <SWRConfig value={{ fallback: { '/api/meetings': meetings } }}>
      <MeetingDashboard />
    </SWRConfig>
  );
}
```

See `references/data-fetching.md` for the full hydration seeding pattern.
