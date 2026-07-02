# Mutations & Forms

## Server Actions for All Mutations

Every data mutation in the Next.js application flows through a Server Action. Client components never call `lib/api.ts` directly for writes — they invoke Server Actions, which run on the server and can safely access secrets, validate data, and revalidate caches.

```tsx
// app/actions/order-actions.ts
'use server';

import { createOrder } from '@/lib/api';
import { createOrderSchema } from '@/lib/schemas';
import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@/lib/schemas/common';
import type { Order } from '@/lib/schemas';

export async function createOrderAction(
  formData: FormData
): Promise<ActionResult<Order>> {
  const parsed = createOrderSchema.safeParse({
    customer_id: formData.get('customer_id'),
    quantity: Number(formData.get('quantity')),
    note: formData.get('note'),
  });

  if (!parsed.success) {
    return { data: null, error: parsed.error.issues[0].message };
  }

  try {
    const order = await createOrder(parsed.data);
    revalidatePath('/orders');
    return { data: order, error: null };
  } catch {
    return { data: null, error: 'Failed to create order. Please try again.' };
  }
}
```

`updateOrderAction` and `deleteOrderAction` follow the identical shape — parse with the matching schema, mutate through `lib/api.ts`, `revalidatePath` the affected routes, return `ActionResult`. `references/security.md` shows the fuller version with authentication and authorization added at the same seam.

---

## The Result Pattern

Every Server Action returns `ActionResult<T>` — a discriminated union the caller narrows on `result.error`, never a throw. The type definition and narrowing example live in `references/type-system.md` → The Result Pattern; this file only shows it in use.

```tsx
const result = await createOrderAction(formData);

if (result.error) {
  showError(result.error);   // TypeScript knows result.data is null
  return;
}

showSuccess(`Created order ${result.data.id}`); // TypeScript knows result.data is Order
```

---

## Form Validation with react-hook-form

All forms use `react-hook-form` paired with `@hookform/resolvers/zod` for client-side validation. The same Zod schema validates on both client (before submission) and server (in the Server Action).

```tsx
// components/orders/order-form.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createOrderSchema, type CreateOrderInput } from '@/lib/schemas';
import { createOrderAction } from '@/app/actions/order-actions';
import { useTransition } from 'react';

export function OrderForm() {
  const [isPending, startTransition] = useTransition();

  const form = useForm<CreateOrderInput>({
    resolver: zodResolver(createOrderSchema),
    defaultValues: { customer_id: '', quantity: 1, note: '' },
  });

  function onSubmit(values: CreateOrderInput) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set('customer_id', values.customer_id);
      formData.set('quantity', String(values.quantity));
      formData.set('note', values.note);

      const result = await createOrderAction(formData);

      if (result.error) {
        form.setError('root', { message: result.error });
        return;
      }

      form.reset(); // clear the form for the next entry — instant reset principle
      toast.success(`Created order ${result.data.id}`);
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label htmlFor="customer_id">Customer</label>
        <input id="customer_id" {...form.register('customer_id')} autoFocus />
        {form.formState.errors.customer_id && (
          <p className="text-destructive">{form.formState.errors.customer_id.message}</p>
        )}
      </div>

      {form.formState.errors.root && (
        <p className="text-destructive">{form.formState.errors.root.message}</p>
      )}

      <button type="submit" disabled={isPending}>
        {isPending ? 'Creating…' : 'Create Order'}
      </button>
    </form>
  );
}
```

### Key Points

- **Same schema, two validation sites** — Zod validates on the client (react-hook-form) for instant feedback, and again on the server (Server Action) for security.
- **`form.setError('root', ...)`** — Server errors surface through react-hook-form's error system, keeping error display consistent.
- **`form.reset()` on success** — Instant reset lets users submit consecutive entries without reaching for the mouse.
- **`autoFocus` on the primary input** — The first field is active the moment the form appears.

---

## Loading States

Two hooks cover mutation loading state; pick by whether the trigger is a `<form>` submit or something else.

```tsx
// useTransition — non-form mutations (button clicks, toggles), or when the parent needs isPending
'use client';
export function DeleteButton({ orderId }: { orderId: string }) {
  const [isPending, startTransition] = useTransition();
  function handleDelete() {
    startTransition(async () => {
      const result = await deleteOrderAction(orderId);
      if (result.error) toast.error(result.error);
    });
  }
  return <button onClick={handleDelete} disabled={isPending}>{isPending ? 'Deleting…' : 'Delete'}</button>;
}
```

```tsx
// useFormStatus — submit buttons inside a <form action={serverAction}>
'use client';
import { useFormStatus } from 'react-dom';
export function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending}>{pending ? 'Saving…' : label}</button>;
}
```

---

## Revalidation After Mutation

After a successful mutation, revalidate affected routes so the UI reflects the change.

```tsx
import { revalidatePath, revalidateTag } from 'next/cache';

revalidatePath('/orders');           // page-level cache bust — re-renders the page
revalidatePath(`/orders/${id}`);
revalidateTag('orders');             // invalidates every cached fetch tagged 'orders'
```

Use `revalidatePath` for page-level cache busting; use `revalidateTag` when multiple routes share data from the same source.

---

## Error Flow

Errors in the Next.js application follow a layered defence strategy:

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

If a Server Action returns an error, the form must preserve what the user typed. The react-hook-form pattern handles this automatically — `form.setError` displays the error without clearing field values, so a failed submit never costs the user their input.

---

## Inline Editing Pattern

Treat content display and editing as the same action. Clicking a text element turns it into an active input field in place — no separate "edit" screen or modal.

```tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { updateOrderAction } from '@/app/actions/order-actions';

export function EditableNote({ order }: { order: Order }) {
  const [isEditing, setIsEditing] = useState(false);
  const [note, setNote] = useState(order.note);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  async function handleBlur() {
    setIsEditing(false);
    if (note === order.note) return; // no change

    const formData = new FormData();
    formData.set('note', note);

    const result = await updateOrderAction(order.id, formData);
    if (result.error) {
      setNote(order.note); // revert on failure
      toast.error(result.error);
    }
  }

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        value={note}
        onChange={e => setNote(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={e => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            setNote(order.note);
            setIsEditing(false);
          }
        }}
      />
    );
  }

  return (
    <p
      onClick={() => setIsEditing(true)}
      className="cursor-pointer hover:text-primary"
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && setIsEditing(true)}
    >
      {note || 'Add a note'}
    </p>
  );
}
```

Key design decisions:
- **Click to edit** — no separate "edit" button cluttering the UI
- **Escape to cancel** — reverts to original value
- **Enter or blur to save** — submits via Server Action
- **Optimistic display** — shows the new value immediately, reverts on failure
- **Keyboard accessible** — `tabIndex={0}` and `onKeyDown` for Enter
