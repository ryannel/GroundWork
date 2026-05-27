---
title: Accessibility
description: WCAG 2.2 AA, keyboard-first design, screen-reader flows, and inclusive UX as a baseline, not a stretch goal.
status: active
last_reviewed: 2026-05-26
---
# Accessibility

## TL;DR

Every user interface we ship meets WCAG 2.2 AA as a baseline. Keyboard, screen reader, and visual assistive technology are first-class targets, not after-launch polish. A feature that does not work for a keyboard user or a screen-reader user is not finished.

## Why this matters

Accessibility is not a niche concern — a significant fraction of users rely on assistive technology at some point. Beyond the moral case (equal access is a baseline), the design constraints that accessibility imposes — clear hierarchy, visible focus, semantic structure, predictable navigation — tend to produce better software for *every* user. An accessible interface is almost always also a clearer, calmer interface.

## Our principles

### 1. WCAG 2.2 AA is the floor, not the ceiling

We conform to WCAG 2.2 AA for every page, every component, every release. AA is the baseline, and we aim for AAA on critical journeys where the cost is bearable. Falling below AA is a bug; it is not a trade-off we make.

### 2. Keyboard first

Every interactive element is reachable and usable with the keyboard. Tab order is logical, focus is always visible, and there are no keyboard traps. The design test is simple: can a power user — or a user who cannot use a mouse — complete every journey without touching the pointer?

### 3. Screen readers see what sighted users see

Semantic HTML first; ARIA only when HTML is not expressive enough. Headings form an outline, landmarks mark regions, form fields carry labels, images carry alt text, live regions announce updates. A screen reader should produce a narrative that matches what a sighted user sees — not a richer or poorer version of it.

### 4. Colour is never the only signal

A red error, a green success, a blue link — each one is accompanied by a label, an icon, or a structural cue. Colour-blind users exist; colour-only signalling is an exclusion.

### 5. Motion is optional

Animations respect `prefers-reduced-motion`. Large-scale parallax and aggressive transitions are used sparingly; for users with vestibular conditions, unrequested motion is not decoration, it is an accessibility failure.

### 6. Live regions are used sparingly and correctly

Real-time updates are announced via `aria-live` when they matter to the user's understanding. But over-announcement is as bad as under-announcement; noisy announcements make screen readers ignore the ones that matter.

### 7. Testing is multi-layered

We run automated accessibility checks in CI (axe, Lighthouse accessibility audits), keyboard-walk every new journey manually, and run screen-reader walkthroughs on major features. Automated testing catches the common failures; humans catch the semantic ones.

### 8. Accessibility is reviewed like code

Accessibility issues are tracked, owned, and closed the same way any other bug is. The backlog does not accumulate "we will get to the a11y later" — that queue grows forever. Every PR author is expected to include the accessibility check in their definition-of-done.

## How we apply this

- [Performance](performance.md) — related budgets that compound with accessibility.

## Anti-patterns we reject

- **Placeholder text as label.** The placeholder disappears when the field is filled; the label is gone. Users who come back to check the field see nothing. Use a visible label.
- **`<div>` as button.** A `div` with an `onClick` is invisible to keyboard, screen reader, and user agent. Use `<button>`.
- **Tiny click targets.** A button smaller than ~44px square is difficult on touch devices and punishing for users with motor impairments.
- **Focus-removal for aesthetics.** `outline: none` without a replacement focus style breaks keyboard navigation entirely.
- **"We will add a11y in v2."** v2 will not have it either. Build it in.
- **Modals without focus management.** Trap focus inside the modal; restore focus when it closes. Otherwise keyboard users are lost.

## Further reading

- *WCAG 2.2* ([w3.org/WAI/WCAG22](https://www.w3.org/WAI/WCAG22)) — the normative standard.
- *Inclusive Components*, Heydon Pickering — the canonical pattern language for accessible UI components.
- *ARIA Authoring Practices Guide* ([w3.org/WAI/ARIA/apg](https://www.w3.org/WAI/ARIA/apg)) — the reference for every ARIA pattern.
- *Accessibility for Everyone*, Laura Kalbag — the short introduction for engineers who need to learn the landscape quickly.
