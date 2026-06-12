# Documentation

## Table of Contents
- [Philosophy: Structure Over Comments](#philosophy-structure-over-comments)
- [Types and Zod as Documentation](#types-and-zod-as-documentation)
- [What to Document](#what-to-document)
- [What NOT to Document](#what-not-to-document)
- [Component Documentation](#component-documentation)
- [Server and Client Boundary Notes](#server-and-client-boundary-notes)
- [Hook Documentation](#hook-documentation)
- [Inline Comments](#inline-comments)
- [In-Code Markers](#in-code-markers)
- [Service README Template](#service-readme-template)

---

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
interface MeetingCardProps {
  meeting: Meeting;
  onSelect?: (meetingId: string) => void;
  variant?: "standard" | "elevated" | "inset";
}
```

The types `Meeting`, `string`, and the union type `"standard" | "elevated" | "inset"` communicate everything a consumer needs to know. Adding comments like `/** The meeting to display */` is noise.

### Zod `.describe()` as Documentation

Zod `.describe()` is structural documentation that flows into validation errors and can be extracted by tooling. It cannot drift because it IS the code:

```tsx
export const meetingSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200).describe("Human-readable meeting title"),
  status: z.enum(["draft", "scheduled", "active", "completed"]),
  scheduledAt: z.string().datetime().nullable(),
});
```

**Rule:** Use `.describe()` only when the field name and type constraints don't tell the full story. `id: z.string().uuid()` is already self-documenting — `.describe("Meeting ID")` is pure noise.

### When Types Are Enough

```tsx
// NO TSDoc needed — the types tell the complete story
function getMeeting(id: string): Promise<Meeting | null>
function deleteMeeting(id: string): Promise<void>
function listMeetings(filter?: MeetingFilter): Promise<Meeting[]>
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
/** MeetingCard displays a card for a meeting */
export function MeetingCard({ meeting }: MeetingCardProps) {

// GOOD — skip it; the name IS the documentation
export function MeetingCard({ meeting }: MeetingCardProps) {
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
interface MeetingCardProps {
  meeting: Meeting;

  /**
   * Memoize with `useCallback` to prevent re-renders
   * inside virtualized lists.
   */
  onSelect?: (meetingId: string) => void;

  variant?: "standard" | "elevated" | "inset";
}
```

Here, `onSelect` has a non-obvious performance implication. The other props need no comments.

**Thin page components:**
```tsx
// SKIP — the delegation IS the documentation
export default async function MeetingsPage() {
  const meetings = await listMeetings();
  return <MeetingList meetings={meetings} />;
}
```

**shadcn/ui primitives** — generated code, never add comments.

**Zod fields where the name + constraints are clear:**
```tsx
// BAD — .describe() adds nothing
status: z.enum(["draft", "scheduled", "active", "completed"]).describe("Meeting status")

// GOOD — skip .describe() when it would just restate the field name
status: z.enum(["draft", "scheduled", "active", "completed"])
```

**Tailwind utility classes** — the class names are the documentation.

---

## Component Documentation

TSDoc on components is justified **only** when the component has non-obvious behavior that types cannot convey:

```tsx
/**
 * Inline meeting editor with optimistic updates.
 *
 * Submits via Server Action and optimistically updates the SWR cache.
 * Rolls back automatically on server error.
 */
"use client";

export function MeetingEditor({ meeting }: MeetingEditorProps) {
```

The optimistic update + rollback behavior is invisible in the props — it justifies documentation. A simple `MeetingCard` that just renders data does not.

---

## Server and Client Boundary Notes

The default is React Server Component — no documentation needed. Document the boundary **only** when using `"use client"` and the rationale is non-obvious:

```tsx
/**
 * Client Component: requires useState for search input tracking
 * and useTransition for non-blocking updates.
 */
"use client";

export function MeetingSearch({ initialResults }: MeetingSearchProps) {
```

**Skip** when `"use client"` is obviously needed (event handlers, form state):
```tsx
// No boundary comment needed — "use client" is obviously required
// for onClick handlers and useState
"use client";

export function MeetingForm({ onSubmit }: MeetingFormProps) {
```

---

## Hook Documentation

Custom hooks are the one area where TSDoc is frequently justified — the caching and revalidation behavior cannot be inferred from the return type:

```tsx
/**
 * Fetches a meeting by ID with SWR caching.
 * Revalidates on focus and reconnect.
 * Seed with SWRConfig fallback to avoid loading flash.
 */
export function useMeeting(meetingId: string) {
  return useSWR<Meeting>(`/api/meetings/${meetingId}`, fetcher);
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
export function MeetingList({ meetings }: MeetingListProps) {
  // Sort descending — server returns chronological, dashboard needs reverse.
  const sorted = useMemo(
    () => [...meetings].sort((a, b) =>
      new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
    ),
    [meetings]
  );

  return (
    // Fragment avoids extra div that breaks parent CSS grid layout.
    <>
      {sorted.map((meeting) => (
        <MeetingCard key={meeting.id} meeting={meeting} />
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

```markdown
# [App Name]

One-sentence description of what this frontend does.

[![CI](badge-url)](ci-url)
[![Coverage](badge-url)](coverage-url)

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
git clone https://github.com/org/[app].git && cd [app]
cp .env.example .env.local
pnpm install && pnpm dev
\```

App: `http://localhost:3000`

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8080` | Backend API |
| `NEXT_PUBLIC_APP_ENV` | `development` | Environment |

## Testing

\```bash
pnpm test              # All tests
pnpm test -- --watch   # Watch mode
pnpm test -- --coverage
\```

## License

[MIT](LICENSE)
```
