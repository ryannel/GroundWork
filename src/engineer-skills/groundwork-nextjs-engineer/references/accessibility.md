# Accessibility

## The Baseline

Accessibility is a merge gate, not a backlog item. The baseline for every surface: native semantic elements over `div` soup, every interactive element keyboard-reachable with a visible focus ring, WCAG AA contrast on text and UI boundaries, programmatic labels on every form field, and motion that honours `prefers-reduced-motion`. An accessibility failure blocks the slice the way a failing test does. The standard is WCAG 2.2 AA — see `docs/principles/quality/accessibility.md`.

## Semantic HTML First, ARIA Last

The first rule of ARIA is that no ARIA is better than bad ARIA — a misapplied `role` silently overrides the native semantics that already worked. Reach for the native element before the attribute:

- Use `<button>`, `<a>`, `<nav>`, `<main>`, `<header>`, `<footer>`, `<article>`, `<section>`. Never a `<div onClick>` for a control — it is invisible to keyboard and assistive tech.
- Headings form an outline: one `<h1>` per page, no skipped levels.
- Reach for ARIA only when HTML cannot express the semantics, and then wire up every state and key handler by hand — an ARIA reimplementation is correct only if complete.

When naming, associate visible text first; fall back to `aria-label` only when there is no on-screen text to reference. Icon-only buttons need an explicit label:

```tsx
<button onClick={onClose} aria-label="Close dialog">
  <X size={20} aria-hidden />
</button>
```

## Keyboard & Focus

Every journey completes without a pointer. Tab order follows reading order, there are no keyboard traps, and focus is always visible.

- Never delete the focus indicator for aesthetics. Style `:focus-visible` so a clear ring shows for keyboard users without firing on mouse clicks:

  ```css
  :focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
  ```

- Composite widgets (menus, tabs, grids) are a single tab stop, then arrow-key navigation inside via roving `tabindex` — a 30-item menu is one tab stop, not thirty.
- Modals and overlays manage focus: trap focus inside while open, return focus to the trigger on close, and mark them with `role="dialog"` and `aria-modal`. Otherwise keyboard users are stranded behind the overlay.

## Contrast & Colour

Contrast is measured against rendered colour, not eyeballed. Body text meets **4.5:1**, large text (18px+, or 14px+ bold) meets **3:1**, and UI component boundaries and meaningful graphics meet **3:1**. Consume the design-system role tokens (see `references/visual-language.md`) so audited pairs stay paired; a hand-mixed colour or opacity hack silently breaks contrast and is a review finding. Verify in both themes.

Colour is never the only signal. Pair every colour-coded state with a second cue — icon, label, or position:

```tsx
<span className="text-success flex items-center gap-1">
  <CheckCircle size={16} aria-hidden />
  Completed
</span>
```

## Accessible Forms

Every field carries a programmatic label — a real `<label htmlFor>`, never a placeholder standing in for one, because the placeholder vanishes on input.

- Errors are announced, not just coloured. Render the message in a `role="alert"` region and tie it to the field with `aria-describedby`; set `aria-invalid` on the failed input.
- A failed submit keeps every entered value, marks each field inline, and moves focus to the first error.
- Use the correct input `type` (`email`, `tel`, `url`) so the right keyboard and validation apply.

## Motion

Animations honour `prefers-reduced-motion`. For users with vestibular conditions, unrequested motion is an accessibility failure, not decoration. The reduced-motion path still communicates the state change — it drops the movement, not the meaning:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Accessibility as the Test Seam

The accessible query is also the test query: Testing Library finds by `getByRole`, `getByLabelText`, and visible text, so **inaccessible UI is untestable UI**. A control with no role and no accessible name is one a screen reader cannot address and a test cannot reach — when a test falls back to `getByTestId` because nothing semantic exists, treat it as the accessibility defect it is and fix the markup.

Automated checks cover the mechanical layer only. Run `jest-axe` on every component that renders interactive elements (see `references/testing.md`), and gate it in CI:

```tsx
it('has no accessibility violations', async () => {
  const { container } = render(<Component />);
  expect(await axe(container)).toHaveNoViolations();
});
```

Axe catches roughly a third of WCAG criteria — it cannot judge whether alt text is meaningful or focus order makes sense. A new journey also earns a manual keyboard walk.

## Review Checklist

- [ ] Native semantic element used; no `div`/`span` as a control.
- [ ] Icon-only buttons carry `aria-label`; ARIA used only where HTML can't express it.
- [ ] Every journey completes by keyboard; focus order matches reading order.
- [ ] `:focus-visible` ring present on all interactive elements.
- [ ] Modals trap and restore focus.
- [ ] Contrast meets AA via theme tokens — no hand-mixed colours.
- [ ] No state communicated by colour alone.
- [ ] Every form field has a programmatic label; errors announced via `role="alert"`.
- [ ] Motion respects `prefers-reduced-motion`.
- [ ] `jest-axe` scan clean; queries find by role/label, not test IDs.
