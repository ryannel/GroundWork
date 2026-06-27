---
title: Usability & UX
description: Heuristics and UX laws applied at decision time, cognitive load, form design, error prevention and recovery, and information scent.
status: active
last_reviewed: 2026-06-20
---
# Usability & UX

## TL;DR

Usability is not a checklist run at the end — it is a set of diagnostic lenses held up to every screen as it is designed. The heuristics and UX laws are tools for *making* decisions, not for auditing them afterwards. The product, not the user, absorbs complexity. Errors are designed out before they are messaged; where they remain, recovery is cheap and the user's work is protected. Every label predicts where it leads.

## Why this matters

Most usability failures are not exotic — they are the same handful of mistakes repeated: silent actions, jargon labels, validation that punishes mid-typing, confirmation dialogs trained into reflexive clicks, forms that ask for what the system already knows, and "click here" links that carry no scent of their destination. Each has a known, defensible fix. The discipline is applying those fixes at design time, when they are free, instead of discovering the problem in a usability test after the structure has hardened around it.

## Our principles

### 1. Apply the heuristics as lenses, not a checklist

Nielsen's ten heuristics are diagnostic lenses held up to a design while it is made: is system status visible, does the language match the user's world, is there a marked exit from every state, is it consistent with what users know from elsewhere, are errors prevented before they are messaged, does it favour recognition over recall, does it serve both novice and expert, is it minimal, do errors route to a fix, is help in context. We reason with them; we do not recite them. A heuristic that surfaces no concrete change to the screen in front of us was not really applied.

### 2. The UX laws carry concrete implications

The laws of UX are design instructions, each with a direct consequence. Fitts: primary actions are large and near the user's pointer, destructive ones small or distant, and screen edges are infinite targets. Hick: reduce and group choices and offer a recommended default. Jakob: meet convention first, because users spend most of their time on *other* products. Miller: chunk information rather than capping menus at seven. Tesler: the product absorbs irreducible complexity through smart defaults and inference. Postel: accept messy input and normalise it silently. Peak-End: invest in the peak moment and the ending. Doherty: keep perceived response under ~400ms, manufacturing it with optimistic UI when real speed is unavailable. Von Restorff: give the single most important action visual distinction; if everything is emphasised, nothing is.

### 3. The product absorbs complexity, not the user

Every system carries irreducible complexity; the only question is who bears it. We make the product bear it — sensible defaults so the common case requires no decision, values derived rather than asked, the happy path optimised for first use with accelerators layered on for experts. We attack *extraneous* cognitive load — visual clutter, inconsistent patterns, unnecessary choices — because every scrap of attention spent decoding the interface is attention not spent on the task. Recognition beats recall: show options and prior choices rather than making the user remember across screens.

### 4. Reveal complexity progressively

We show the common 80% first and tuck advanced options one discoverable layer deep, because deferred complexity is managed complexity and a flatter surface lowers the decision cost of the common case. For complex, branching, or low-confidence flows — onboarding, checkout, anything official — one question per page beats a long wall of fields, because it lowers load and handles validation, branching, and save-progress far better.

### 5. Forms ask less, validate kindly, and never lose work

A form is a single column, top to bottom, with labels above the field — the layout that completes fastest and survives translation — and never a placeholder standing in for a label, because the placeholder vanishes on input and fails review and accessibility. We validate on blur and confirm success inline, never erroring mid-keystroke, because punishing not-yet-finished input is hostile. On a failed submit we keep every entered value, mark each field inline, summarise at the top, and move focus to the first error. We pre-fill what we can infer and cut every field not needed now, because each field measurably lowers completion, and we use the correct input type and accept any reasonable format.

### 6. Prevent the error; make recovery cheap

The cheapest error to recover from is the one that cannot occur, so we design errors out first with constraints, smart defaults, and forgiving formats before designing any message. For reversible actions we act immediately and offer Undo rather than a confirmation dialog, because dialogs train reflexive "yes" clicks and interrupt flow while Undo respects momentum; confirmation is reserved for the genuinely destructive and irreversible. Where a message is still needed, it states what happened, why, and how to fix it, in plain language at the point of the error, styled to be noticed without blame or raw error codes. Work is protected by autosave and a warning before discarding unsaved changes.

### 7. Every label predicts where it leads

Users forage by scent: they choose links and buttons by the payoff each label predicts, so labels are descriptive and specific and match the content they lead to — never "click here," "learn more," or a bare "submit." Every screen answers the wayfinding questions — where am I, how did I get here, where can I go, how do I get back — through an active navigation state, a clear title, breadcrumbs in deep hierarchies, and consistent, persistent navigation. Disorientation is a silent driver of abandonment.

### 8. Usable has a floor you can check and a ceiling you judge

"Usable" splits into two halves that need different instruments. The **floor is checkable**: every screen is reachable and has a way back, so no flow dead-ends; every asynchronous view carries its full set of states — empty, loading, in-progress, error — not just the happy one a demo hits. These are verifiable, and their absence is a defect a review catches: a screen that works but shows no progress reads as frozen, and a grid with no empty state reads as broken on first run. The **ceiling is judged**: whether the screens cohere, whether the product is a pleasure to use, whether it feels considered. That judgment is made by eye, the way a designer reviews work, against the design system and the experience the product is reaching for. Hold the floor as a gate and the ceiling as a bar — clear the first, then keep raising the second.

### 9. Solve UX problems with the patterns the best products use now, implemented fully

For a recurring UX problem there is usually a current best-in-class solution the leading products have converged on — the removable filter pill with its clear affordance, the skeleton frame that holds layout while content loads, modern search and pagination. Reaching for these gives forward-leaning and familiar at once, because the leaders made them the standard. The discipline is to implement the pattern **completely**, every affordance it implies: a filter pill that shows but does not remove is a worse experience than no pill, because it promises an interaction it does not honour. Draw on what modern products already do and on the project's own design references, then turn the chosen pattern into a real component in the design system so the next screen inherits it rather than re-inventing a thinner version.

## How we apply this

- [Interaction & Motion](interaction-and-motion.md) — the state, feedback, and perceived-performance decisions usability depends on.
- [Accessibility](../quality/accessibility.md) — keyboard operability, focus management, and error association as the operable backbone of usability.
- [Design Foundations](design-foundations.md) — usability is the design-owned risk in the four-risk frame.

## Anti-patterns we reject

- **Heuristics as an audit.** Reciting the ten heuristics after the fact instead of using them to change the design as it is made.
- **Placeholder as label.** A label that disappears the moment the field is filled, defeating review and accessibility.
- **Validation mid-keystroke.** Red errors thrown before the user has finished a field, punishing in-progress input.
- **Lost work on failure.** Clearing the form or losing entered data when a submit fails.
- **Confirmation-dialog overuse.** "Are you sure?" on routine reversible actions, training the reflexive click that defeats the dialog's purpose.
- **Asking for the known.** Requiring data the system already has or could derive.
- **Scentless labels.** "Click here" / "Learn more" / generic "Next" that predict nothing about their destination.
- **Dead-end screens.** A view a user can reach but not leave, or a flow with no way back to where they came from.
- **Happy-path-only states.** An async view that renders when data arrives but shows nothing while it loads, nothing when it is empty, and nothing when it fails — so working software looks frozen and a first run looks broken.
- **The half-built pattern.** A recognised pattern shipped as a shell — a filter pill that does not remove, a skeleton that never resolves — promising an affordance it does not deliver.

## Further reading

- Nielsen Norman Group, *10 Usability Heuristics* and the supporting article corpus.
- Jon Yablonski, *Laws of UX* — the laws above, each with its design implication.
- Luke Wroblewski, *Web Form Design* — single-column forms, label placement, and inline validation.
- GOV.UK Design System, *Question pages* — one-thing-per-page for complex and branching flows.
