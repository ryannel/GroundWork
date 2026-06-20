---
title: Accessibility
description: WCAG 2.2 AA, keyboard-first design, screen-reader flows, and inclusive UX as a baseline, not a stretch goal — and, since the EAA, a legal floor.
status: active
last_reviewed: 2026-06-19
---
# Accessibility

## TL;DR

Every user interface we ship meets WCAG 2.2 AA as a baseline. Keyboard, screen reader, and visual assistive technology are first-class targets, not after-launch polish. A feature that does not work for a keyboard user or a screen-reader user is not finished.

## Why this matters

Accessibility is not a niche concern — a significant fraction of users rely on assistive technology at some point, and almost everyone hits a situational version of it (a broken arm, glare on a phone, a noisy room). Three forces make it non-negotiable:

- **The moral case.** Equal access is a baseline, not a feature flag.
- **The legal case.** Accessibility is now mandated, not merely encouraged. The EU's European Accessibility Act took effect on 28 June 2025; its harmonized standard, EN 301 549, currently incorporates WCAG 2.1 AA (with 2.2 in progress) for products and digital services placed on the EU market. In the US, the ADA continues to drive thousands of web-accessibility suits a year. "Inaccessible" is a compliance defect with a price tag.
- **The quality case.** The constraints accessibility imposes — clear hierarchy, visible focus, semantic structure, predictable navigation — produce better software for *every* user. An accessible interface is almost always also a clearer, calmer interface.

The reason to be deliberate about this is that the default is failure. In WebAIM's 2025 audit of the top one million home pages, 94.8% had detectable WCAG A/AA failures — roughly 51 errors per page. Accessibility does not happen by accident; it is engineered in or it is absent.

## Our principles

### 1. WCAG 2.2 AA is the floor, not the ceiling

We conform to WCAG 2.2 AA for every page, every component, every release. Falling below AA is a bug, not a trade-off we make.

But "aim for AAA everywhere" is the wrong correction, and the W3C says so directly: Level AAA is *not recommended as a general policy for entire sites*, because some AAA criteria are impossible to satisfy for some content (sign-language interpretation for all audio; a lower-secondary reading level for technical reference). A blanket-AAA target is one you are guaranteed to miss, which trains the team to treat the standard as aspirational rather than binding. The decision rule: **AA across the board, non-negotiable; specific AAA criteria adopted where a journey is critical and the criterion is actually achievable** — enhanced 7:1 contrast (1.4.6), visible location/breadcrumbs (2.4.8), context-sensitive help (3.3.5), no surprise session timeouts (2.2.6). Targeting 2.2 AA keeps us ahead of the EAA's current legal baseline, not behind it. WCAG 3.0 remains an early W3C Working Draft with a different conformance model — track it, but do not architect around it.

### 2. Keyboard first

Every interactive element is reachable and usable with the keyboard. Tab order follows reading order, focus is always visible, and there are no keyboard traps. The design test is simple: can a power user — or a user who cannot use a pointer — complete every journey without touching the mouse? Composite widgets (menus, grids, tab sets) follow the ARIA Authoring Practices keyboard model: a single tab stop into the widget, then arrow-key navigation inside it via roving `tabindex`, so a 30-item menu is one tab stop, not thirty.

### 3. Screen readers see what sighted users see

Semantic HTML first; ARIA only when HTML cannot express the semantics. The first rule of ARIA is that *no ARIA is better than bad ARIA*: in WebAIM's million-page survey, pages using ARIA averaged 41% more detected errors than pages without it, because a misapplied `role` silently overrides the native semantics that already worked. A native `<button>`, `<nav>`, or `<label>` is correct by construction; an ARIA reimplementation is correct only if you also wire up every state and key handler by hand.

When you do name something, follow the accessible-name priority: associate visible text first (`aria-labelledby` pointing at on-screen copy), and reach for `aria-label` only when there is no visible text to reference. Headings form an outline, landmarks mark regions, form fields carry programmatic labels, images carry meaningful alt text. A screen reader should produce a narrative that matches what a sighted user sees — not a richer or poorer version of it.

### 4. Contrast is measured, not eyeballed

Low-contrast text is the single most common accessibility failure on the web — present on roughly 79% of the top million home pages and the largest single share of all detected errors. It is also the most preventable. Body text meets 4.5:1, large text 3:1 (SC 1.4.3); UI component boundaries and meaningful graphics meet 3:1 (SC 1.4.11). These ratios are verified by tooling against the actual rendered colours, not judged by eye on a designer's calibrated monitor in a dark room. Brand palettes are checked against contrast at design time; a colour pair that fails AA is a palette bug, not a creative choice to defend.

### 5. Colour is never the only signal

A red error, a green success, a blue link — each one carries a second, non-colour cue: a label, an icon, an underline, a position. Colour-blind users exist, and colour-only signalling excludes them (SC 1.4.1). This is distinct from contrast: a chart can have perfect contrast and still be unreadable if its only key is "the red line versus the green line."

### 6. Motion is optional

Animations respect `prefers-reduced-motion`. Large-scale parallax and aggressive transitions are used sparingly; for users with vestibular conditions, unrequested motion is not decoration, it is an accessibility failure. The reduced-motion path is a real design, not a disabled one — it still communicates state change, just without the movement that triggers nausea.

### 7. Live regions are used sparingly and correctly

Real-time updates are announced via `aria-live` when they matter to the user's understanding. But over-announcement is as harmful as silence: a region that fires on every keystroke or background poll teaches the user to tune out the announcements that matter. Use `aria-live="polite"` for status that can wait, reserve `assertive` for genuine interruptions (errors, time-critical alerts), and announce the meaningful delta, not the whole region.

### 8. Testing is multi-layered

Automated checks (axe, Lighthouse) run in CI on every build as a gate. But know their ceiling. Deque's analysis of ~2,000 real audits found automated tooling fully covers about 57% of issues *by volume* — and that figure is flattered by colour contrast alone, one high-frequency criterion. Measured by share of WCAG success criteria, automated coverage is closer to a third. Tools cannot judge whether alt text is *meaningful*, whether focus order makes *sense*, or whether a live-region announcement is useful or noise. So the gate has three layers: automated checks in CI, a manual keyboard walk on every new journey, and a screen-reader walkthrough on major features. Test against the combinations users actually run — NVDA with Firefox or Chrome, VoiceOver with Safari, and JAWS for enterprise audiences — because behaviour differs across them. Tools catch the mechanical; humans catch the semantic.

### 9. Accessibility is reviewed like code

Accessibility issues are tracked, owned, and closed the same way any other bug is. The backlog does not accumulate a "we will get to the a11y later" queue — that queue grows forever. Every PR author is expected to include the accessibility check in their definition-of-done.

## How we apply this

- [Performance](performance.md) — related budgets that compound with accessibility.

## Anti-patterns we reject

- **Placeholder text as label.** The placeholder disappears when the field is filled; the label is gone. Users who come back to check the field see nothing. Use a visible label.
- **`<div>` as button.** A `div` with an `onClick` is invisible to keyboard, screen reader, and user agent. Use `<button>`.
- **Cramped tap targets.** WCAG 2.2 AA (SC 2.5.8) sets the floor at 24×24 CSS px, or equivalent spacing between smaller targets. That is a floor, not a goal: touch surfaces should aim for ~44×44 (Apple's HIG and the AAA SC 2.5.5), because fingertips are wide and motor-impaired users miss small targets at far higher error rates.
- **Focus-removal for aesthetics.** `outline: none` without a replacement focus style breaks keyboard navigation entirely. Use `:focus-visible` to style a clear indicator, not to delete one.
- **Accessibility overlay widgets.** Bolt-on "accessibility" scripts (accessiBe and its peers) do not make a site conformant, and frequently fight the user's own assistive technology. They are a liability, not a shield: over a thousand sites running an overlay were sued in 2024, settlements routinely require *removing* the widget, and the FTC fined accessiBe $1M in 2025 for deceptive accessibility claims. Fix the markup; do not paper over it.
- **"We will add a11y in v2."** v2 will not have it either. Build it in.
- **Modals without focus management.** Trap focus inside the modal, return focus to the trigger when it closes, and label it with `aria-modal`/`role="dialog"`. Otherwise keyboard users are lost behind it.

## Further reading

- *WCAG 2.2* ([w3.org/WAI/WCAG22](https://www.w3.org/WAI/WCAG22)) and *Understanding Conformance* ([w3.org/WAI/WCAG22/Understanding/conformance](https://www.w3.org/WAI/WCAG22/Understanding/conformance)) — the normative standard and the rationale for why AAA is not a blanket policy.
- *ARIA Authoring Practices Guide* ([w3.org/WAI/ARIA/apg](https://www.w3.org/WAI/ARIA/apg)) and *Using ARIA* ([w3.org/TR/using-aria](https://www.w3.org/TR/using-aria)) — the reference for every ARIA pattern and the five rules of ARIA use.
- *The WebAIM Million* ([webaim.org/projects/million](https://webaim.org/projects/million)) — the annual reality check on what actually fails on the open web.
- *European Accessibility Act / EN 301 549* — the EU legal baseline; the harmonized standard that maps the law to WCAG.
- *Inclusive Components*, Heydon Pickering — the canonical pattern language for accessible UI components.
- *Accessibility for Everyone*, Laura Kalbag — the short introduction for engineers who need to learn the landscape quickly.
</content>
</invoke>
