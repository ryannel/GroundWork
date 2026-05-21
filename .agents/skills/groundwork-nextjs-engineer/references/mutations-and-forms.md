# Mutations & Forms

## Table of Contents
- [Server Actions for All Mutations](#server-actions-for-all-mutations)
- [The Result Pattern](#the-result-pattern)
- [Form Validation with react-hook-form](#form-validation-with-react-hook-form)
- [Loading States](#loading-states)
- [Revalidation After Mutation](#revalidation-after-mutation)
- [Error Flow](#error-flow)
- [Inline Editing Pattern](#inline-editing-pattern)

---

## Server Actions for All Mutations

Every data mutation in the the Next.js application flows through a Server Action. Client components never call `lib/api.ts` directly for writes — they invoke Server Actions, which run on the server and can safely access secrets, validate data, and revalidate caches.

```tsx
// app/actions/meeting-actions.ts
'use server';

import { createMeeting, updateMeeting, deleteMeeting } from '@/lib/api';
import { createMeetingSchema, updateMeetingSchema } from '@/lib/schemas';
import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@/lib/schemas/common';
import type { Meeting } from '@/lib/schemas';

export async function createMeetingAction(
  formData: FormData
): Promise<ActionResult<Meeting>> {
  const parsed = createMeetingSchema.safeParse({
    title: formData.get('title'),
    starts_at: formData.get('starts_at'),
    duration_minutes: Number(formData.get('duration_minutes')),
  });

  if (!parsed.success) {
    return { data: null, error: parsed.error.issues[0].message };
  }

  try {
    const meeting = await createMeeting(parsed.data);
    revalidatePath('/meetings');
    return { data: meeting, error: null };
  } catch {
    return { data: null, error: 'Failed to create meeting. Please try again.' };
  }
}

export async function updateMeetingAction(
  id: string,
  formData: FormData
): Promise<ActionResult<Meeting>> {
  const parsed = updateMeetingSchema.safeParse({
    title: formData.get('title'),
    duration_minutes: Number(formData.get('duration_minutes')),
  });

  if (!parsed.success) {
    return { data: null, error: parsed.error.issues[0].message };
  }

  try {
    const meeting = await updateMeeting(id, parsed.data);
    revalidatePath('/meetings');
    revalidatePath(`/meetings/${id}`);
    return { data: meeting, error: null };
  } catch {
    return { data: null, error: 'Failed to update meeting.' };
  }
}

export async function deleteMeetingAction(
  id: string
): Promise<ActionResult<null>> {
  try {
    await deleteMeeting(id);
    revalidatePath('/meetings');
    return { data: null, error: null };
  } catch {
    return { data: null, error: 'Failed to delete meeting.' };
  }
}
```

---

## The Result Pattern

Every Server Action returns `ActionResult<T>`. This prevents unhandled exceptions from crashing the client. The caller always receives either data or an error string — never a throw.

```tsx
// lib/schemas/common.ts
export type ActionResult<T> =
  | { data: T; error: null }
  | { data: null; error: string };
```

This type is a discriminated union. The caller checks `result.error` to determine which branch they're in:

```tsx
const result = await createMeetingAction(formData);

if (result.error) {
  // TypeScript knows: result.data is null
  showError(result.error);
  return;
}

// TypeScript knows: result.data is Meeting, result.error is null
showSuccess(`Created: ${result.data.title}`);
```

---

## Form Validation with react-hook-form

All forms use `react-hook-form` paired with `@hookform/resolvers/zod` for client-side validation. The same Zod schema validates on both client (before submission) and server (in the Server Action).

```tsx
// components/meetings/meeting-form.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createMeetingSchema, type CreateMeetingInput } from '@/lib/schemas';
import { createMeetingAction } from '@/app/actions/meeting-actions';
import { useTransition } from 'react';

export function MeetingForm() {
  const [isPending, startTransition] = useTransition();

  const form = useForm<CreateMeetingInput>({
    resolver: zodResolver(createMeetingSchema),
    defaultValues: {
      title: '',
      starts_at: '',
      duration_minutes: 30,
    },
  });

  function onSubmit(values: CreateMeetingInput) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set('title', values.title);
      formData.set('starts_at', values.starts_at);
      formData.set('duration_minutes', String(values.duration_minutes));

      const result = await createMeetingAction(formData);

      if (result.error) {
        form.setError('root', { message: result.error });
        return;
      }

      // Clear the form for the next entry (instant reset principle)
      form.reset();
      toast.success(`Created: ${result.data.title}`);
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label htmlFor="title">Title</label>
        <input
          id="title"
          {...form.register('title')}
          autoFocus  {/* Focus immediately — speed principle */}
        />
        {form.formState.errors.title && (
          <p className="text-[--color-error]">
            {form.formState.errors.title.message}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="duration">Duration (minutes)</label>
        <input
          id="duration"
          type="number"
          {...form.register('duration_minutes', { valueAsNumber: true })}
        />
      </div>

      {form.formState.errors.root && (
        <p className="text-[--color-error]">
          {form.formState.errors.root.message}
        </p>
      )}

      <button type="submit" disabled={isPending}>
        {isPending ? 'Creating…' : 'Create Meeting'}
      </button>
    </form>
  );
}
```

### Key Points

- **Same schema, two validation sites** — Zod validates on the client (react-hook-form) for instant feedback, and again on the server (Server Action) for security.
- **`form.setError('root', ...)`** — Server errors are surfaced through react-hook-form's error system, keeping error display consistent.
- **`form.reset()` on success** — Instant reset lets users submit consecutive entries without reaching for the mouse.
- **`autoFocus` on primary input** — The first field is active the moment the form appears.

---

## Loading States

### useTransition (Preferred for Non-Form Mutations)

`useTransition` keeps the current UI responsive while the mutation runs. The `isPending` flag drives loading states.

```tsx
'use client';

import { useTransition } from 'react';
import { deleteMeetingAction } from '@/app/actions/meeting-actions';

export function DeleteButton({ meetingId }: { meetingId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteMeetingAction(meetingId);
      if (result.error) {
        toast.error(result.error);
      }
    });
  }

  return (
    <button onClick={handleDelete} disabled={isPending}>
      {isPending ? 'Deleting…' : 'Delete'}
    </button>
  );
}
```

### useFormStatus (For Form Buttons)

`useFormStatus` reads the pending state of the nearest parent `<form>`. Use it for submit buttons that need to show loading state.

```tsx
'use client';

import { useFormStatus } from 'react-dom';

export function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending}>
      {pending ? 'Saving…' : label}
    </button>
  );
}
```

### When to Use Which

| Pattern | Use When |
|---------|----------|
| `useTransition` | Non-form mutations (button clicks, toggle switches), or when you need the `isPending` value in the parent component |
| `useFormStatus` | Submit buttons inside a `<form>` that uses `action={serverAction}` |

---

## Revalidation After Mutation

After a successful mutation, revalidate affected routes so the UI reflects the change.

```tsx
import { revalidatePath } from 'next/cache';
import { revalidateTag } from 'next/cache';

// Revalidate a specific path — re-renders the page
revalidatePath('/meetings');
revalidatePath(`/meetings/${id}`);

// Revalidate by cache tag — invalidates all cached fetches with that tag
revalidateTag('meetings');
```

Use `revalidatePath` for page-level cache busting. Use `revalidateTag` when multiple routes share data from the same source.

---

## Error Flow

Errors in the the Next.js application follow a layered defence strategy:

```
┌─ Client validation (react-hook-form + Zod) ─ catches typos, missing fields
│
├─ Server validation (Server Action + Zod) ─ catches malicious/stale input
│
├─ API error (ActionResult.error) ─ catches backend failures
│
├─ SWR error state ─ graceful degradation for fetch failures
│
└─ React Error Boundary (error.tsx) ─ catastrophic UI failure
```

### Preserving User Input

If a Server Action returns an error, the form must preserve what the user typed. The react-hook-form pattern handles this automatically — `form.setError` displays the error without clearing field values.

```tsx
// When the server returns an error, the form fields retain their values
const result = await createMeetingAction(formData);
if (result.error) {
  form.setError('root', { message: result.error });
  // Fields are NOT cleared — user can fix and resubmit
  return;
}
```

---

## Inline Editing Pattern

Treat content display and editing as the same action. Clicking a text element turns it into an active input field in place — no separate "edit" screen or modal.

```tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { updateMeetingAction } from '@/app/actions/meeting-actions';

export function EditableTitle({ meeting }: { meeting: Meeting }) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(meeting.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  async function handleBlur() {
    setIsEditing(false);
    if (title === meeting.title) return;  // No change

    const formData = new FormData();
    formData.set('title', title);

    const result = await updateMeetingAction(meeting.id, formData);
    if (result.error) {
      setTitle(meeting.title);  // Revert on failure
      toast.error(result.error);
    }
  }

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        value={title}
        onChange={e => setTitle(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={e => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            setTitle(meeting.title);
            setIsEditing(false);
          }
        }}
      />
    );
  }

  return (
    <h1
      onClick={() => setIsEditing(true)}
      className="cursor-pointer hover:text-[--color-accent]"
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && setIsEditing(true)}
    >
      {title}
    </h1>
  );
}
```

Key design decisions:
- **Click to edit** — no separate "edit" button cluttering the UI
- **Escape to cancel** — reverts to original value
- **Enter or blur to save** — submits via Server Action
- **Optimistic display** — shows new title immediately, reverts on failure
- **Keyboard accessible** — `tabIndex={0}` and `onKeyDown` for Enter
