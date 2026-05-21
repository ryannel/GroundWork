# Routing & Navigation

## Table of Contents
- [File-Based Routing](#file-based-routing)
- [Route Segments](#route-segments)
- [Proxy (Middleware)](#proxy-middleware)
- [Parallel Routes](#parallel-routes)
- [Intercepting Routes](#intercepting-routes)
- [Modal Pattern](#modal-pattern)
- [Navigation Hooks](#navigation-hooks)
- [Suspense Boundaries for Hooks](#suspense-boundaries-for-hooks)
- [Link Component](#link-component)

---

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
| `default.tsx` | Fallback for parallel route slots | No |

---

## Route Segments

```
app/
├── meetings/              # Static: /meetings
├── [id]/                  # Dynamic: /:id
├── [...slug]/             # Catch-all: /a/b/c (requires at least one segment)
├── [[...slug]]/           # Optional catch-all: / or /a/b/c
├── (dashboard)/           # Route group — ignored in URL
└── _components/           # Private folder — excluded from routing
```

### Route Groups

Route groups `(name)` organise routes without affecting the URL. Use them to apply different layouts to subsets of routes:

```
app/
├── (auth)/
│   ├── login/page.tsx      # /login — uses auth layout
│   ├── register/page.tsx   # /register — uses auth layout
│   └── layout.tsx          # Minimal layout for auth pages
├── (app)/
│   ├── dashboard/page.tsx  # /dashboard — uses app layout
│   └── layout.tsx          # Full layout with sidebar
└── layout.tsx              # Root layout
```

### Private Folders

Prefix a folder with `_` to exclude it from routing. Use for co-located components that shouldn't become routes:

```
app/meetings/
├── _components/
│   └── meeting-filters.tsx   # Not a route — co-located helper
├── page.tsx                  # /meetings
└── [id]/
    └── page.tsx              # /meetings/:id
```

---

## Proxy (Middleware)

In Next.js 16, middleware has been renamed to **proxy** for clarity. The file lives at the project root and runs before every request.

```tsx
// proxy.ts (project root)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  // Example: redirect unauthenticated users
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

| Version | File | Export | Config |
|---------|------|--------|--------|
| v14-15 | `middleware.ts` | `middleware()` | `config` |
| v16+ | `proxy.ts` | `proxy()` | `proxyConfig` |

To migrate: `pnpx @next/codemod@latest upgrade`

---

## Parallel Routes

Parallel routes render multiple pages simultaneously in the same layout. Each slot renders independently and can have its own loading and error states.

### File Structure

```
app/
├── @modal/                     # Parallel route slot
│   ├── default.tsx             # Required — returns null
│   └── (.)meetings/[id]/      # Intercepts /meetings/:id
│       └── page.tsx            # Modal content
├── meetings/
│   ├── page.tsx                # /meetings (gallery/list)
│   └── [id]/
│       └── page.tsx            # /meetings/:id (full page)
├── layout.tsx                  # Receives children + modal slot
└── page.tsx
```

### Layout with Slots

```tsx
// app/layout.tsx
export default function RootLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
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

### default.tsx is Critical

Every parallel route slot **must** have a `default.tsx` that returns `null`. Without it, refreshing any page returns a 404 because Next.js cannot determine what to render in the empty slot.

```tsx
// app/@modal/default.tsx
export default function Default() {
  return null;
}
```

---

## Intercepting Routes

Intercepting routes show a different UI when navigating from within the app versus accessing the URL directly. Combined with parallel routes, they enable modal patterns.

### Matchers

| Matcher | Intercepts | Example |
|---------|-----------|---------|
| `(.)` | Same level | `@modal/(.)meetings` intercepts `/meetings` |
| `(..)` | One level up | `@modal/(..)settings` intercepts `/settings` from a child |
| `(..)(..)` | Two levels up | Rarely used |
| `(...)` | From root | `@modal/(...)meetings` intercepts `/meetings` from anywhere |

These match **route segments**, not filesystem paths. A common mistake is thinking `(..)` means "parent folder" — it means "parent route segment."

### Hard Navigation Behaviour

| Navigation Type | What Renders |
|----------------|-------------|
| **Soft navigation** (clicking a Link) | Intercepting route (modal) |
| **Hard navigation** (URL bar, refresh, bookmark) | Full page (not intercepted) |

---

## Modal Pattern

The complete pattern for an intercepting modal:

### Step 1: Link Triggers Interception

```tsx
// app/meetings/page.tsx
import Link from 'next/link';

export default async function MeetingsPage() {
  const meetings = await getMeetings();

  return (
    <div className="bento-grid">
      {meetings.data.map(meeting => (
        <Link key={meeting.id} href={`/meetings/${meeting.id}`}>
          <MeetingCard meeting={meeting} />
        </Link>
      ))}
    </div>
  );
}
```

### Step 2: Intercepting Route Renders Modal

```tsx
// app/@modal/(.)meetings/[id]/page.tsx
import { getMeeting } from '@/lib/api';
import { Modal } from '@/components/ui/modal';

type Props = { params: Promise<{ id: string }> };

export default async function MeetingModal({ params }: Props) {
  const { id } = await params;
  const meeting = await getMeeting(id);

  return (
    <Modal>
      <h2>{meeting.title}</h2>
      <p>{meeting.status}</p>
    </Modal>
  );
}
```

### Step 3: Modal Closes with router.back()

Use `router.back()` to close modals. Never use `router.push('/')` or `<Link href="/">` — these create broken history entries.

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
    [router]
  );

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'oklch(0 0 0 / 0.5)' }}
    >
      <div className="glass-elevated max-w-2xl w-full mx-4 p-6">
        <button
          onClick={() => router.back()}
          className="absolute top-4 right-4"
          aria-label="Close"
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}
```

### Why router.back(), Not router.push()

| Method | Behaviour |
|--------|-----------|
| `router.back()` | Removes intercepted route from history, returns to previous page, properly unmounts modal |
| `router.push('/')` | Adds new history entry (back button reopens modal), doesn't clear intercept state, modal may flash or persist |

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

`useSearchParams()` always requires a Suspense boundary. Without one, the entire page bails out to client-side rendering.

```tsx
// Bad — entire page becomes CSR
'use client';
import { useSearchParams } from 'next/navigation';

export default function SearchPage() {
  const searchParams = useSearchParams();
  return <div>Query: {searchParams.get('q')}</div>;
}
```

```tsx
// Good — wrap in Suspense
import { Suspense } from 'react';
import { SearchContent } from '@/components/search-content';

export default function SearchPage() {
  return (
    <Suspense fallback={<div>Loading search…</div>}>
      <SearchContent />
    </Suspense>
  );
}
```

`usePathname()` requires a Suspense boundary in dynamic routes (routes with `[param]` segments). If `generateStaticParams` is used, the boundary is optional.

---

## Static Route Pre-rendering

Use `generateStaticParams` to pre-render dynamic routes at build time. This eliminates server-side rendering on each request for known pages.

```tsx
// app/meetings/[id]/page.tsx
export async function generateStaticParams() {
  const meetings = await getMeetings();
  return meetings.data.map(meeting => ({ id: meeting.id }));
}

export default async function MeetingPage({ params }: Props) {
  const { id } = await params;
  const meeting = await getMeeting(id);
  return <MeetingDetail meeting={meeting} />;
}
```

Pages generated by `generateStaticParams` are statically rendered at build time. Pages with dynamic params not returned by `generateStaticParams` are rendered on-demand and then cached.

When `generateStaticParams` is used, `usePathname()` no longer requires a Suspense boundary because the path is known at build time.

---

## Link Component

Always use `next/link` for internal navigation. Never use raw `<a>` tags for internal links.

```tsx
// Bad
<a href="/meetings">Meetings</a>

// Good
import Link from 'next/link';
<Link href="/meetings">Meetings</Link>
```

### Active Link Styling

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={isActive ? 'text-[--color-accent]' : 'text-[--color-text-secondary]'}
    >
      {children}
    </Link>
  );
}
```
