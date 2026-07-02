# UX Principles

This reference is judgment rules, not values. It fixes no duration, easing curve, scale amount, or feature inventory — those are per-product decisions in `docs/design-system.md`. Read that file for what a given app's power-user affordances and motion timings actually are; this file covers how to reason about interaction quality once you know them.

## Speed & Interaction

The UI must feel zero-latency for common actions. Speed is not a feature — it is the foundation of trust.

- **Focus inputs immediately** — when a form or dialog opens, the primary input field is focused without the user touching the mouse (`autoFocus` or `useRef` + `useEffect`).
- **Inline editing** — treat "viewing" and "editing" as the same action. Clicking a text element activates an in-place input; no separate "edit" screen, no confirmation dialog for routine edits. Pattern: `references/mutations-and-forms.md` → Inline Editing Pattern.
- **Optimistic UI** — update the interface immediately when the user acts; show the intended result while the server confirms, revert only on failure. Pattern: `references/data-fetching.md` → Optimistic UI.
- **Instant resets** — after a successful form submission, clear all fields immediately so the user can submit the next entry without reaching for a mouse.

| Don't | Why | Do Instead |
|-------|-----|-----------|
| Separate "view" and "edit" screens | Forces navigation for simple edits | Inline editing — click to edit in place |
| Full-page loading spinner for submissions | Blocks the entire UI for one operation | Optimistic update + a subtle loading indicator on the action element |
| "Are you sure?" for reversible actions | Interrupts flow unnecessarily | Allow immediate action; offer "Undo" for a few seconds |
| Unfocused form dialogs | User must click to start typing | `autoFocus` on the primary field |

---

## Navigation & Control

Power-user affordances — a command palette, keyboard shortcuts — are per-product decisions recorded in the design system, not fixed here. When the design system specifies one, give it instant focus and keyboard-navigable results, dismiss on `Escape`, style it with `.surface-elevated` (`references/visual-language.md`), and keep bindings discoverable through a help overlay rather than tribal knowledge.

**Context switching** between views should be instantaneous. Use layout-based navigation so persistent chrome (sidebar, header) stays mounted while only the content panel changes — avoid full-page reloads for in-app navigation.

---

## Information Architecture

The most important content occupies the largest surface area and appears first in the visual hierarchy — apply whichever layout mechanism (grid, list, a size-graduated card system) the project's design system uses to express importance through size and position; don't invent an ad-hoc one per screen. Show only what matters right now, revealing detail on interaction (expand/collapse, hover cards, drill-down).

Build hierarchy through the primary/secondary/disabled text-role tokens rather than a hand-picked opacity value, and build a single clear focal point per screen from typography weight, layout-given surface area, colour contrast, and motion — the first (and only) animated element on screen is the focal point.

---

## Feedback & Motion

Motion communicates state change; durations, easing curves, and transform amounts are the design system's call, projected as `--gw-motion-*` tokens — consume them, never invent a timing. Full mechanics: `references/tailwind-and-styling.md` → Motion mechanics.

The judgment rules that don't change per app:

- **Entry direction relates to origin** — a bottom sheet enters from the bottom, a sidebar from its edge, a tooltip from near its trigger; the design system supplies the timing.
- **Tactile feedback on press** — a subtle scale or opacity shift on press, sized by the design system's motion token; a shift large enough to read as "cartoonish" is a design-system violation, not a matter of taste.
- **Calm alerts** — status indicators use the semantic role tokens (`success`, `error`/`destructive`, `warning`, `info`), never a hand-picked hex. Toasts are dismissible, auto-fade after a reasonable duration for success, persist for errors, and never stack into a pile.
- **Actions reveal contextually** — on hover, selection, or focus (`opacity-0 group-hover:opacity-100 group-focus-within:opacity-100`), rather than showing every possible action at all times.

---

## Accessibility

Accessibility is a merge gate, not optional polish — semantic HTML, keyboard reachability, WCAG AA contrast, and labelled forms are a baseline requirement on every surface. See `references/accessibility.md` for the full reference.

---

## Empty States & Onboarding

### Day-Zero Experience

When a user first encounters a section with no data, the empty state explains what the section is for, offers a single clear action to populate it, and uses a friendly illustration or icon rather than a blank page:

```tsx
export function EmptyOrderList() {
  return (
    <div className="surface-glass p-8 text-center">
      <PackagePlus size={48} className="mx-auto text-muted-foreground" aria-hidden />
      <h3 className="text-title mt-4">No orders yet</h3>
      <p className="text-muted-foreground mt-2">Create your first order to get started.</p>
      <Button className="mt-6">
        <Plus size={16} aria-hidden />
        Create Order
      </Button>
    </div>
  );
}
```

### Actionable Error States

Error states tell the user what went wrong and what they can do about it — never a raw error code ("Error 500: ECONNREFUSED") or technical jargon. Same `surface-glass` shape as the empty state above, plus a retry action; see `references/error-boundaries.md` → error.tsx for the full pattern.

### Input Preservation

If a form submission fails, never clear the user's input. The react-hook-form + `ActionResult` pattern handles this automatically — `form.setError()` displays the server error without resetting field values.

---

## Copy & Tone

- **Concise** — say it in fewer words; if a label can be one word, use one word.
- **Active voice** — "Order created," not "An order has been created."
- **Context-sensitive** — error messages are empathetic, success messages are brief, help text is instructional.

| Context | Tone | Example |
|---------|------|---------|
| Success | Brief, confident | "Saved" / "Order created" |
| Error | Empathetic, actionable | "Couldn't save. Check your connection and try again." |
| Empty state | Encouraging, helpful | "No orders yet. Create your first one." |
| Destructive action | Clear, honest | "Delete this order? This can't be undone." |
| Loading | Invisible preferred | Skeleton UI, not "Loading..." text |

Punctuation: button labels and toast messages carry no period ("Save", "Order created"); error messages that are full sentences do ("Check your connection and try again."); labels carry no trailing colon ("Duration", not "Duration:").
