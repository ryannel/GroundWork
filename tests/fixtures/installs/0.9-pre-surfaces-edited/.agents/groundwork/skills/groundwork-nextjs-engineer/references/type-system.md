# Type System & Schemas

## Table of Contents
- [Zod as the Contract](#zod-as-the-contract)
- [Schema Organisation](#schema-organisation)
- [Deriving Types](#deriving-types)
- [Discriminated Unions](#discriminated-unions)
- [Exhaustive Matching](#exhaustive-matching)
- [The Result Pattern](#the-result-pattern)
- [RSC Serialisation Boundary](#rsc-serialisation-boundary)
- [Type Guards over any](#type-guards-over-any)

---

## Zod as the Contract

Zod schemas are the single source of truth for all data shapes in the codebase. They serve as the type contract between the Go backend API and the React frontend. Every API response is validated against a Zod schema, and all TypeScript types for API data are derived from those schemas.

Standalone TypeScript interfaces for API data are forbidden — they drift from reality. Zod schemas enforce runtime validation and compile-time types simultaneously.

```tsx
// lib/schemas/meeting.ts
import { z } from 'zod';

export const meetingSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']),
  host_id: z.string().uuid(),
  starts_at: z.string().datetime(),
  duration_minutes: z.number().int().positive(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Meeting = z.infer<typeof meetingSchema>;

export const meetingListSchema = z.object({
  data: z.array(meetingSchema),
  pagination: z.object({
    next_cursor: z.string().nullable(),
    has_more: z.boolean(),
  }),
});

export type MeetingList = z.infer<typeof meetingListSchema>;
```

### Why Zod over Interfaces

- **Runtime validation** — API responses are parsed, not assumed. If the backend changes a field name or type, the schema catches it immediately instead of producing silent runtime bugs.
- **Single definition** — The schema defines shape, constraints, and TypeScript type in one place.
- **Form integration** — Zod schemas plug directly into `react-hook-form` via `@hookform/resolvers/zod` for validation.

---

## Schema Organisation

All schemas live in `lib/schemas/` with zero internal application dependencies. A schema file must never import from hooks, components, contexts, or the API client.

```
lib/schemas/
├── meeting.ts                 # Meeting entity schemas
├── meeting-synthesis.ts       # Synthesis-related schemas
├── user.ts                    # User entity schemas
├── common.ts                  # Shared schemas (pagination, error responses)
└── index.ts                   # Barrel export
```

Each file exports:
1. The Zod schema object (`meetingSchema`)
2. The inferred TypeScript type (`Meeting`)
3. Any sub-schemas needed for forms or partial updates

```tsx
// lib/schemas/index.ts
export { meetingSchema, type Meeting, meetingListSchema, type MeetingList } from './meeting';
export { userSchema, type User } from './user';
export { paginationSchema, type Pagination } from './common';
```

---

## Deriving Types

Always derive types from schemas using `z.infer`. Never write parallel TypeScript interfaces.

```tsx
// Correct — type derived from schema
export const meetingSchema = z.object({ /* ... */ });
export type Meeting = z.infer<typeof meetingSchema>;

// Incorrect — standalone interface duplicates the schema and will drift
export interface Meeting {
  id: string;
  title: string;
  // This will get out of sync with the schema
}
```

### Partial and Pick Types

Derive form-specific types from the base schema:

```tsx
// Schema for creating a meeting (subset of fields)
export const createMeetingSchema = meetingSchema.pick({
  title: true,
  starts_at: true,
  duration_minutes: true,
});

export type CreateMeetingInput = z.infer<typeof createMeetingSchema>;

// Schema for updating a meeting (all fields optional)
export const updateMeetingSchema = meetingSchema.partial().omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type UpdateMeetingInput = z.infer<typeof updateMeetingSchema>;
```

---

## Discriminated Unions

Use discriminated unions to model states that are mutually exclusive. This prevents impossible states at the type level — the compiler enforces that only valid combinations of fields are accessed.

```tsx
// Correct — discriminated union makes invalid states impossible
const meetingInputSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('recording'),
    recording_url: z.string().url(),
    device_id: z.string(),
  }),
  z.object({
    type: z.literal('upload'),
    file_path: z.string(),
    file_size: z.number().positive(),
  }),
]);

type MeetingInput = z.infer<typeof meetingInputSchema>;

// Usage — the compiler knows which fields exist based on type
function processMeetingInput(input: MeetingInput) {
  switch (input.type) {
    case 'recording':
      // TypeScript knows recording_url and device_id exist here
      startRecording(input.recording_url, input.device_id);
      break;
    case 'upload':
      // TypeScript knows file_path and file_size exist here
      uploadFile(input.file_path, input.file_size);
      break;
  }
}
```

```tsx
// Incorrect — loose optional fields allow impossible states
const meetingInputSchema = z.object({
  type: z.enum(['recording', 'upload']),
  recording_url: z.string().url().optional(),      // When is this present?
  device_id: z.string().optional(),                 // What if type is 'upload'?
  file_path: z.string().optional(),                 // What if type is 'recording'?
  file_size: z.number().positive().optional(),
});
// Nothing prevents { type: 'recording', file_path: '/foo' }
```

---

## Exhaustive Matching

Always enforce exhaustive matching on discriminated unions using `default: never`. This catches unhandled cases at compile time when new variants are added.

```tsx
type MeetingStatus = Meeting['status'];  // 'scheduled' | 'in_progress' | 'completed' | 'cancelled'

function getStatusLabel(status: MeetingStatus): string {
  switch (status) {
    case 'scheduled':
      return 'Upcoming';
    case 'in_progress':
      return 'Live';
    case 'completed':
      return 'Done';
    case 'cancelled':
      return 'Cancelled';
    default: {
      // If a new status is added to the enum, this line produces a compile error
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}
```

When a fifth status (e.g., `'archived'`) is added to the schema, the compiler flags every switch statement that doesn't handle it.

---

## The Result Pattern

All Server Actions return a strictly typed `ActionResult<T>` to prevent unhandled client-side crashes from failed mutations. A Server Action must never throw — it always returns a result.

### Type Definition

```tsx
// lib/schemas/common.ts
type ActionResult<T> =
  | { data: T; error: null }
  | { data: null; error: string };
```

### Server Action Implementation

```tsx
// app/actions/meeting-actions.ts
'use server';

import { createMeetingSchema, type Meeting } from '@/lib/schemas';
import { createMeeting } from '@/lib/api';
import { revalidatePath } from 'next/cache';

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
```

### Client Consumption

```tsx
'use client';

import { createMeetingAction } from '@/app/actions/meeting-actions';
import { useTransition } from 'react';

function CreateMeetingButton() {
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createMeetingAction(formData);
      if (result.error) {
        // Show error in UI — never an unhandled throw
        toast.error(result.error);
        return;
      }
      // Successfully created
      toast.success(`Created: ${result.data.title}`);
    });
  }

  return (
    <form action={handleSubmit}>
      {/* form fields */}
      <button type="submit" disabled={isPending}>
        {isPending ? 'Creating…' : 'Create Meeting'}
      </button>
    </form>
  );
}
```

---

## RSC Serialisation Boundary

When a Server Component passes props to a Client Component, those props must be JSON-serialisable. React serialises them across the server-client boundary, and non-serialisable values either silently corrupt or crash.

### What Can Cross the Boundary

| Type | Serialisable? | Notes |
|------|-------------|-------|
| `string`, `number`, `boolean` | Yes | |
| `null`, `undefined` | Yes | |
| Plain objects and arrays | Yes | No class instances |
| Server Actions (`'use server'`) | Yes | The only exception for functions |
| `Date` | **No** | Silently becomes a string — `.getFullYear()` crashes on the client |
| `Map`, `Set` | **No** | Silently stripped |
| Functions (non-Server Action) | **No** | Cannot be serialised |
| Class instances | **No** | Methods are stripped |
| `Symbol` | **No** | Unless globally registered |

### Fixing Non-Serialisable Props

```tsx
// Bad — Date object silently becomes string, then crashes
export default async function Page() {
  const meeting = await getMeeting(id);
  return <MeetingCard createdAt={meeting.created_at} />;  // Date object
}

// Good — serialise to ISO string on the server
export default async function Page() {
  const meeting = await getMeeting(id);
  return <MeetingCard createdAt={meeting.created_at.toISOString()} />;
}

// Bad — Map cannot be serialised
<ClientComponent items={new Map([['a', 1]])} />

// Good — convert to plain object
<ClientComponent items={Object.fromEntries(map)} />

// Bad — function prop (not a Server Action)
export default function Page() {
  const handleClick = () => console.log('clicked');
  return <ClientButton onClick={handleClick} />;  // Cannot serialise
}

// Good — define the function inside the client component
'use client';
export function ClientButton() {
  const handleClick = () => console.log('clicked');
  return <button onClick={handleClick}>Click</button>;
}
```

---

## Type Guards over any

The `any` type is forbidden. When dealing with unknown data (external APIs, dynamic content, user input), use `unknown` and narrow the type using type guards or Zod parsing.

```tsx
// Bad — any bypasses all type checking
function processResponse(data: any) {
  return data.meetings[0].title;  // No type safety — runtime explosion
}

// Good — unknown + Zod parsing
function processResponse(data: unknown) {
  const parsed = meetingListSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(`Invalid API response: ${parsed.error.message}`);
  }
  return parsed.data.data[0].title;  // Fully typed
}

// Good — type guard for narrowing
function isMeeting(value: unknown): value is Meeting {
  return meetingSchema.safeParse(value).success;
}
```
