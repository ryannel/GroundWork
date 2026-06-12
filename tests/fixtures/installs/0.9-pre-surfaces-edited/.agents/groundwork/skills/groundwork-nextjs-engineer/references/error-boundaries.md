# Error Boundaries

## Table of Contents
- [Error Hierarchy](#error-hierarchy)
- [error.tsx](#errortsx)
- [global-error.tsx](#global-errortsx)
- [not-found.tsx](#not-foundtsx)
- [Auth Errors](#auth-errors)
- [Navigation API Gotcha](#navigation-api-gotcha)
- [Redirects](#redirects)
- [Hydration Errors](#hydration-errors)
- [Post-Response Work with after()](#post-response-work-with-after)

---

## Error Hierarchy

Errors bubble up from the component that throws to the nearest error boundary. Place `error.tsx` at different levels to control the granularity of error recovery.

```
app/
├── error.tsx               # Catches errors from all children
├── global-error.tsx        # Catches errors in root layout
├── meetings/
│   ├── error.tsx           # Catches errors in /meetings/*
│   └── [id]/
│       ├── error.tsx       # Catches errors in /meetings/[id]
│       └── page.tsx
└── layout.tsx              # Errors here go to global-error.tsx
```

An `error.tsx` boundary does **not** catch errors thrown in the `layout.tsx` of the same segment — those bubble up to the parent segment's error boundary or `global-error.tsx`.

---

## error.tsx

Catches runtime errors in a route segment and its children. Provides a `reset` function to retry rendering.

`error.tsx` **must** be a Client Component.

```tsx
// app/meetings/error.tsx
'use client';

export default function MeetingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="glass-surface p-6 text-center" role="alert">
      <h2 className="text-[--color-error]">Something went wrong</h2>
      <p className="text-[--color-text-secondary] mt-2">
        Failed to load meetings. This has been logged.
      </p>
      <button
        onClick={reset}
        className="mt-4 px-4 py-2 bg-[--color-accent] rounded"
      >
        Try again
      </button>
    </div>
  );
}
```

### Important

- The `digest` property is a hash of the error that was thrown on the server. Use it for log correlation — never display it to users.
- Sensitive error details (stack traces, internal messages) are stripped before reaching the client. Only generic messages should be shown to users.

---

## global-error.tsx

Catches errors thrown in the **root layout**. Because the root layout is replaced entirely when this renders, `global-error.tsx` must include its own `<html>` and `<body>` tags.

```tsx
// app/global-error.tsx
'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h2>Something went wrong</h2>
          <p>An unexpected error occurred. Please try refreshing the page.</p>
          <button onClick={reset}>Try again</button>
        </div>
      </body>
    </html>
  );
}
```

Note: `global-error.tsx` cannot use the app's CSS imports or layout — it replaces the entire document. Keep it self-contained with inline styles.

---

## not-found.tsx

Custom 404 UI for a route segment. Place at any level to customise the 404 experience for that section of the app.

```tsx
// app/meetings/not-found.tsx
import Link from 'next/link';

export default function MeetingNotFound() {
  return (
    <div className="glass-surface p-8 text-center">
      <h2 className="text-xl font-semibold">Meeting not found</h2>
      <p className="text-[--color-text-secondary] mt-2">
        This meeting may have been deleted or the link is incorrect.
      </p>
      <Link href="/meetings" className="mt-4 text-[--color-accent] inline-block">
        Back to meetings
      </Link>
    </div>
  );
}
```

### Triggering Not Found

```tsx
import { notFound } from 'next/navigation';

export default async function MeetingPage({ params }: Props) {
  const { id } = await params;
  const meeting = await getMeeting(id);

  if (!meeting) {
    notFound();  // Renders closest not-found.tsx
  }

  return <MeetingDetail meeting={meeting} />;
}
```

---

## Auth Errors

Trigger specific auth-related error pages:

```tsx
import { forbidden, unauthorized } from 'next/navigation';

export default async function AdminPage() {
  const session = await getSession();

  if (!session) {
    unauthorized();  // Renders unauthorized.tsx (401)
  }

  if (!session.hasAdminAccess) {
    forbidden();     // Renders forbidden.tsx (403)
  }

  return <AdminDashboard />;
}
```

Create corresponding error pages:

```tsx
// app/forbidden.tsx
export default function Forbidden() {
  return (
    <div className="glass-surface p-8 text-center">
      <h2>Access Denied</h2>
      <p className="text-[--color-text-secondary]">
        You don't have permission to view this resource.
      </p>
    </div>
  );
}

// app/unauthorized.tsx
export default function Unauthorized() {
  return (
    <div className="glass-surface p-8 text-center">
      <h2>Sign In Required</h2>
      <p className="text-[--color-text-secondary]">
        Please sign in to access this page.
      </p>
    </div>
  );
}
```

---

## Navigation API Gotcha

`redirect()`, `notFound()`, `forbidden()`, and `unauthorized()` work by throwing special internal errors. If you wrap them in a try-catch, the catch block intercepts the navigation error and the navigation silently fails.

```tsx
// ❌ Bad — try-catch catches the navigation "error"
'use server';

async function createMeeting(formData: FormData) {
  try {
    const meeting = await db.meeting.create({ ... });
    redirect(`/meetings/${meeting.id}`);  // This throws!
  } catch (error) {
    // redirect() throw is caught here — navigation fails silently!
    return { error: 'Failed to create meeting' };
  }
}
```

### Fix 1: Call Navigation Outside try-catch

```tsx
// ✅ Good — navigation API outside the try-catch
async function createMeeting(formData: FormData) {
  let meeting;
  try {
    meeting = await db.meeting.create({ ... });
  } catch (error) {
    return { error: 'Failed to create meeting' };
  }
  redirect(`/meetings/${meeting.id}`);  // Outside try-catch
}
```

### Fix 2: Re-throw with unstable_rethrow

When the navigation must be inside the try-catch:

```tsx
import { unstable_rethrow } from 'next/navigation';

async function createMeeting(formData: FormData) {
  try {
    const meeting = await db.meeting.create({ ... });
    redirect(`/meetings/${meeting.id}`);
  } catch (error) {
    unstable_rethrow(error);  // Re-throws Next.js internal errors
    return { error: 'Failed to create meeting' };
  }
}
```

### Affected Functions

All of these throw internal errors — never wrap them in try-catch without `unstable_rethrow`:
- `redirect()` — 307 temporary redirect
- `permanentRedirect()` — 308 permanent redirect
- `notFound()` — 404
- `forbidden()` — 403
- `unauthorized()` — 401

---

## Redirects

```tsx
import { redirect, permanentRedirect } from 'next/navigation';

// 307 Temporary — use for most cases (auth redirects, feature gates)
redirect('/new-path');

// 308 Permanent — use for URL migrations (browsers cache this)
permanentRedirect('/new-url');
```

Use `redirect()` for dynamic routing decisions (auth, feature flags). Use `permanentRedirect()` only when the old URL is permanently retired and should be cached by browsers and search engines.

---

## Hydration Errors

Hydration errors occur when the server-rendered HTML doesn't match the client-rendered HTML. React detects the mismatch and throws an error.

### Error Signs

- "Hydration failed because the initial UI does not match"
- "Text content does not match server-rendered HTML"

### Common Causes and Fixes

#### Browser APIs

```tsx
// ❌ Bad — window doesn't exist on server
<div>{window.innerWidth}</div>

// ✅ Good — render on client only after mount
'use client';
import { useState, useEffect } from 'react';

export function WindowWidth() {
  const [width, setWidth] = useState<number>();
  useEffect(() => setWidth(window.innerWidth), []);
  return <div>{width ?? 'Loading…'}</div>;
}
```

#### Date/Time Rendering

Server and client may be in different timezones:

```tsx
// ❌ Bad — different timezone on server vs client
<span>{new Date().toLocaleString()}</span>

// ✅ Good — render on client only
'use client';
const [time, setTime] = useState<string>();
useEffect(() => setTime(new Date().toLocaleString()), []);
```

#### Random Values and IDs

```tsx
// ❌ Bad — Math.random differs between server and client
<div id={Math.random().toString()}>

// ✅ Good — useId generates stable IDs across server/client
import { useId } from 'react';

function Input() {
  const id = useId();
  return <input id={id} />;
}
```

#### Invalid HTML Nesting

```tsx
// ❌ Bad — <div> inside <p> is invalid HTML
<p><div>Content</div></p>

// ❌ Bad — <p> inside <p> is invalid HTML
<p><p>Nested</p></p>

// ✅ Good — valid nesting
<div><p>Content</p></div>
```

### Debugging Hydration Errors

In development, click the hydration error overlay to see a diff of server vs client HTML. This pinpoints the exact element that mismatched.

#### Third-Party Scripts

Browser extensions and third-party scripts can inject DOM elements that don't exist in the server-rendered HTML, causing hydration mismatches. If you see hydration errors that disappear in Incognito Mode, a browser extension is the likely cause. Use `next/script` with `strategy="afterInteractive"` instead of raw `<script>` tags to avoid this.

---

## Post-Response Work with after()

`after()` runs code after the response finishes streaming. Use it for logging, analytics, or cleanup that shouldn't delay the response.

```tsx
import { after } from 'next/server';

export async function POST(request: Request) {
  const data = await processRequest(request);

  after(async () => {
    // This runs after the response is sent
    await logAnalytics(data);
    await sendNotification(data);
  });

  return Response.json({ success: true });
}
```

`after()` does not block the response. The client receives the response immediately while the deferred work runs in the background.
