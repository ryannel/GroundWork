# Accessibility

When you advise on accessibility, treat it as a design-time property, not a remediation phase — the constraints it imposes (clear hierarchy, visible focus, semantic structure, predictable navigation) produce better software for every user. WCAG 2.2 AA is the floor for every surface; a feature that fails a keyboard or screen-reader user is not finished.

## WCAG 2.2 AA is the floor, not the ceiling

Conform to WCAG 2.2 AA for every page, component, and release, aiming higher on critical journeys where the cost is bearable. Falling below AA is a bug, not a trade-off. The 2.2 additions that bite at design time are concrete: interactive targets at least 24×24px (or spaced to compensate), a focused element never fully hidden behind sticky chrome, any drag operation with a single-pointer alternative, and authentication that allows password managers and paste rather than a memory test.

## Keyboard first; manage focus

Every interactive element is reachable and usable by keyboard, tab order is logical, focus is always visible, and there are no keyboard traps. The design test is simple: can a user who cannot use a pointer complete every journey? Never remove the focus outline without a replacement meeting 3:1 contrast; use `:focus-visible` to show it for keyboard and not mouse. On client-side route changes, move focus to the new view and announce it, because a silent route change is the dominant single-page-app accessibility bug. In a modal, move focus in, trap it while open, close on Escape, and return focus to the trigger.

## Semantic HTML first; ARIA only to augment

Reach for native elements — `<button>`, `<a href>`, `<input>`/`<label>`, `<nav>`, `<dialog>` — before any ARIA, because native elements carry role, name, state, keyboard behaviour, and focus for free, and bad ARIA measurably *adds* errors. ARIA augments (`aria-expanded`, `aria-current`, live regions); it never adds behaviour and never overrides a visible name. Give the screen reader structure: one `<main>` and landmark regions, a heading outline with no skipped levels, an accessible name on every control. Announce dynamic updates through an `aria-live` region that already exists in the DOM at load — but sparingly, because over-announcement makes screen readers ignore what matters.

## Colour is never the only signal; motion is optional

Any meaning carried by colour is redundantly encoded with text, icon, shape, or position, because colour-only signalling excludes colourblind users. Text meets 4.5:1 (3:1 for large and for non-text UI). Honour `prefers-reduced-motion`: disable parallax and large transitions, keep essential feedback — unrequested motion is an accessibility failure for vestibular users, not decoration — and honour `prefers-contrast` and `prefers-color-scheme`.

## Testing is multi-layered

Automated checks (axe, Lighthouse) run in CI as a non-negotiable gate, but they catch only ~30–40% of criteria, so they are the floor: keyboard-walk every new journey, run a screen-reader pass on key flows, and spot-check contrast, 200% zoom, and reduced motion. Automation finds the mechanical failures; humans find the semantic ones — whether alt text is meaningful, whether focus order makes sense, whether a custom widget actually works with assistive technology.

## Antipatterns to catch

- **Placeholder as label.** It disappears on input; the field's purpose is then gone.
- **`<div>` as button.** Invisible to keyboard, screen reader, and user agent — use `<button>`.
- **Focus removal for aesthetics.** `outline: none` with no replacement breaks keyboard navigation.
- **Colour-only state.** Red/green error and success with no text or icon.
- **Modals without focus management.** Focus left behind, the page read underneath, no return on close.
- **"We'll add a11y in v2."** v2 will not have it either; build it in.
- **"axe passes, so it's accessible."** False confidence over the untested majority of criteria.
