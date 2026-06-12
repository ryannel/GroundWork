# UX Principles

## Table of Contents
- [Speed & Interaction](#speed--interaction)
- [Navigation & Control](#navigation--control)
- [Information Architecture](#information-architecture)
- [Feedback & Motion](#feedback--motion)
- [Accessibility](#accessibility)
- [Empty States & Onboarding](#empty-states--onboarding)
- [Copy & Tone](#copy--tone)

---

## Speed & Interaction

The UI must feel zero-latency for common actions. Speed is not a feature — it is the foundation of trust.

### Principles

- **Focus inputs immediately** — When a form or dialog opens, the primary input field must be focused without the user touching the mouse. Use `autoFocus` or `useRef` + `useEffect`.
- **Inline editing** — Treat "viewing" and "editing" as the same action. Clicking a text element activates an in-place input. No separate "edit" screens, no confirmation dialogs for routine edits.
- **Optimistic UI** — Update the interface immediately when the user acts. Show the intended result while the server confirms. Revert only on failure. See `references/data-fetching.md` for the SWR `mutate()` pattern.
- **Instant resets** — After a successful form submission, clear all fields immediately so the user can submit the next entry without reaching for a mouse or navigating.

### Anti-patterns

| Don't | Why | Do Instead |
|-------|-----|-----------|
| Separate "view" and "edit" screens | Forces navigation for simple edits | Inline editing — click to edit in place |
| Full-page loading spinner for submissions | Blocks the entire UI for a single operation | Optimistic update + subtle loading indicator on the action element |
| "Are you sure?" confirmation dialogs for reversible actions | Interrupts flow unnecessarily | Allow immediate action; provide "Undo" for 5 seconds |
| Unfocused form dialogs | User must click to start typing | `autoFocus` on the primary field |

---

## Navigation & Control

### Command Palette

The command palette is the central navigation hub. Users can search for anything — pages, actions, meetings, settings — from a single keyboard-activated overlay.

- Launch with `⌘K` (macOS) / `Ctrl+K`
- Results group by category (pages, actions, recent items)
- Keyboard navigation with arrow keys + Enter
- Uses `.glass-elevated` styling (see `references/visual-language.md`)

### Keyboard Shortcuts

Power users should never be forced to use the mouse. Provide shortcuts for frequent actions:

| Action | Shortcut | Context |
|--------|----------|---------|
| Command palette | `⌘K` | Global |
| Quick search | `/` | When no input is focused |
| New meeting | `N` | Meeting list view |
| Close modal/dialog | `Escape` | Any overlay |

### Context Switching

Switching between views should be instantaneous. Use layout-based navigation so the sidebar and header persist while only the content panel changes. Avoid full-page reloads.

---

## Information Architecture

### Content-First Layout

The most important content occupies the largest surface area and appears first in the visual hierarchy. Use the bento grid to establish importance through sizing (see `references/visual-language.md`).

### Progressive Disclosure

Show only what matters right now. Additional details reveal on interaction:
- Expand/collapse sections for secondary information
- Hover cards for quick previews
- Drill-down for detailed views

### Opacity-Based Depth

Use text opacity to create visual hierarchy without additional colours:
- Primary text: full opacity via `--color-text-primary`
- Secondary text (metadata, timestamps): reduced opacity via `--color-text-secondary`
- Disabled/inactive elements: further reduced opacity

### Focal Points

Create clear visual focal points using:
- **Typography weight** — Bold headings draw the eye before body text
- **Surface area** — Larger bento grid cells command more attention
- **Colour contrast** — Accent colour on CTAs, muted tones for everything else
- **Motion** — The first (and only) animated element on screen is the focal point

---

## Feedback & Motion

### Liquid Transitions

All transitions should feel organic and fluid — never mechanical or jarring.

- **Entry:** Elements fade in and slide from their origin direction (bottom sheet from bottom, sidebar from left, tooltip from near the trigger)
- **Duration:** 150-300ms for micro-interactions (button press, toggle); 300-500ms for layout transitions (panel open/close)
- **Easing:** `ease-out` for elements appearing; `ease-in` for elements leaving. Never `linear`.

### Tactile Scale Shifts

Interactive elements respond to press with a subtle scale reduction:

```css
.interactive-element {
  transition: transform 150ms ease-out;
}

.interactive-element:active {
  transform: scale(0.97);  /* 3% reduction — barely perceptible, deeply satisfying */
}
```

Never exceed 5% scale change — larger shifts feel cartoonish.

### Calm Alerts

Notifications and status indicators use muted colours from the palette — no harsh stoplight reds or electric greens.

| State | Colour | Token |
|-------|--------|-------|
| Success | Sage Green | `--color-success` |
| Error | Muted Rose | `--color-error` |
| Warning | Warm Amber | `--color-warning` |
| Info | Accent Blue | `--color-accent` |

Toasts and banners should be dismissible, auto-fade after a reasonable duration (4-6 seconds for success, persistent for errors), and never stack vertically in a pile of doom.

### Progressive Disclosure of Actions

Actions should reveal contextually — on hover, on selection, or on focus. Don't show every possible action at all times.

```tsx
// Actions appear on hover/focus
<div className="group relative">
  <MeetingCard meeting={meeting} />
  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 
                  group-focus-within:opacity-100 transition-opacity">
    <EditButton />
    <DeleteButton />
  </div>
</div>
```

---

## Accessibility

Accessibility is not optional — it is a baseline requirement.

### Contrast

- Body text must meet **WCAG AA** (4.5:1 contrast ratio)
- Large text (18px+ or 14px+ bold) must meet **3:1**
- Interactive elements must meet **3:1** against their background
- Test in both Obsidian and Milk themes

### Focus States

- All interactive elements must have a visible focus indicator
- Focus indicators must contrast with the background (not just browser default outline)
- Tab order must follow visual layout order

```css
:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}
```

### Semantic HTML & ARIA

- Use semantic elements: `<nav>`, `<main>`, `<article>`, `<section>`, `<aside>`, `<header>`, `<footer>`
- Icon-only buttons must have `aria-label`:
  ```tsx
  <button onClick={handleClose} aria-label="Close dialog">
    <X size={20} />
  </button>
  ```
- Use `role="alert"` for error messages that must be announced by screen readers
- Never use `div` or `span` for clickable elements — use `button` or `a`

### Colour Independence

- Never communicate information through colour alone
- Pair colour indicators with icons or text labels:
  ```tsx
  // Bad — colour-only status
  <span className="text-[--color-success]">●</span>
  
  // Good — colour + icon + text
  <span className="text-[--color-success] flex items-center gap-1">
    <CheckCircle size={16} aria-hidden />
    Completed
  </span>
  ```

---

## Empty States & Onboarding

### Day-Zero Experience

When a user first encounters a section with no data, the empty state should:
1. Explain what this section is for
2. Provide a single clear action to populate it
3. Use a friendly illustration or icon (not a blank page)

```tsx
export function EmptyMeetingList() {
  return (
    <div className="glass-surface p-8 text-center">
      <CalendarPlus size={48} className="mx-auto text-[--color-text-secondary]" aria-hidden />
      <h3 className="text-title mt-4">No meetings yet</h3>
      <p className="text-[--color-text-secondary] mt-2">
        Schedule your first meeting to get started.
      </p>
      <Button className="mt-6">
        <Plus size={16} aria-hidden />
        Schedule Meeting
      </Button>
    </div>
  );
}
```

### Actionable Error States

Error states must tell the user what went wrong and what they can do about it. Never show raw error codes or technical jargon.

```tsx
// Bad
<p>Error 500: ECONNREFUSED</p>

// Good
<div className="glass-surface p-6 text-center" role="alert">
  <AlertCircle size={32} className="mx-auto text-[--color-error]" aria-hidden />
  <h3 className="text-title mt-4">Couldn't load your meetings</h3>
  <p className="text-[--color-text-secondary] mt-2">
    We're having trouble connecting right now. Your data is safe.
  </p>
  <Button onClick={reset} className="mt-4">Try again</Button>
</div>
```

### Input Preservation

If a form submission fails, **never clear the user's input**. The react-hook-form + ActionResult pattern handles this automatically — `form.setError()` displays the server error without resetting field values.

---

## Copy & Tone

### Voice Principles

- **Concise** — Say it in fewer words. If a label can be one word, use one word.
- **Active voice** — "Meeting created" not "A meeting has been created."
- **Context-sensitive** — Error messages are empathetic. Success messages are brief. Help text is instructional.

| Context | Tone | Example |
|---------|------|---------|
| Success | Brief, confident | "Saved" / "Meeting created" |
| Error | Empathetic, actionable | "Couldn't save. Check your connection and try again." |
| Empty state | Encouraging, helpful | "No meetings yet. Schedule your first one." |
| Destructive action | Clear, honest | "Delete this meeting? This can't be undone." |
| Loading | Invisible preferred | Use skeleton UI, not "Loading..." text |

### Punctuation

- Button labels: no period ("Save", not "Save.")
- Toast messages: no period ("Meeting created", not "Meeting created.")
- Error messages: period at end if a full sentence ("Check your connection and try again.")
- Labels: no period ("Duration", not "Duration:")
