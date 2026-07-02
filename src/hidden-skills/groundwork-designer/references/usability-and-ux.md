# Usability & UX

When you advise on usability, the heuristics and UX laws are tools for *making* the decision in front of you, not a checklist to run afterward. The discipline is applying the known fix at design time, when it is free, instead of discovering the problem in a test after the structure has hardened around it.

## Heuristics and laws as decision lenses

Hold the heuristics up as lenses while you design: is status visible, does the language match the user's world, is there a marked exit from every state, is it consistent with what users know elsewhere, are errors prevented before messaged, recognition favoured over recall, both novice and expert served, errors routed to a fix. The UX laws carry direct implications — Fitts: primary actions large and near, destructive small or distant, edges are infinite targets. Hick: reduce and group choices, offer a default. Jakob: meet convention first. Tesler: the product absorbs irreducible complexity, not the user. Postel: accept messy input and normalise it. Peak-End: invest in the peak and the ending. Von Restorff: distinguish the one most important action — if everything is emphasised, nothing is.

## The product absorbs complexity

Make the product bear the load: sensible defaults so the common case needs no decision, values derived rather than asked, the happy path tuned for first use with accelerators layered for experts. Attack *extraneous* cognitive load — clutter, inconsistency, unnecessary choices — because every scrap of attention spent decoding the UI is attention off the task. Reveal complexity progressively: the common 80% first, advanced options one discoverable layer deep. For complex or branching flows, one question per page beats a long wall of fields.

## Forms ask less, validate kindly, never lose work

A form is a single column with labels above the field — fastest to complete, survives translation — never a placeholder standing in for a label, which vanishes on input and fails review and accessibility. Validate on blur and confirm success inline, never erroring mid-keystroke. On failed submit, keep every value, mark each field inline, summarise at the top, and move focus to the first error. Pre-fill what you can infer, cut every field not needed now (each one lowers completion), use the right input type, and accept any reasonable format.

## Prevent the error; make recovery cheap

The cheapest error is the one that cannot occur, so design errors out first with constraints, smart defaults, and forgiving formats before writing any message. For reversible actions, act immediately and offer Undo rather than a confirmation dialog, because dialogs train reflexive "yes" clicks while Undo respects momentum; reserve confirmation for the genuinely destructive. A message states what happened, why, and how to fix it, in plain language at the point of error, without blame or raw codes. Protect work with autosave and a warning before discarding unsaved changes.

## Every label predicts where it leads

Users forage by scent, choosing links by the payoff each label predicts, so labels are specific and match their destination — never "click here," "learn more," or a bare "submit." Every screen answers the wayfinding questions (where am I, how did I get here, where can I go, how do I get back) through an active nav state, a clear title, breadcrumbs in deep hierarchies, and persistent navigation. Disorientation is a silent driver of abandonment.

## The floor is checkable; the ceiling is judged

Usable splits into two instruments. The floor is checkable — every screen reachable with a way back, no dead ends; every async view carries its full state set (empty, loading, in-progress, error), not just the happy path. Absence is a defect a review catches, the way a failing test is. The ceiling is judged: whether the screens cohere and the product is a pleasure to use, by eye, against the design system and `## Design References`. Clear the floor as a gate; keep raising the ceiling as a bar.

## Use the current best-in-class pattern, implemented completely

Most recurring UX problems have a best-in-class solution the leading products converged on — the removable filter pill, the loading skeleton, modern search and pagination. Reach for it: forward-leaning and familiar at once. Implement it **completely** — a filter pill that shows but does not remove is worse than no pill; it promises an affordance it does not honour. Promote the chosen pattern into the design system so the next screen inherits it.

## Antipatterns to catch

- **Heuristics as an audit.** Reciting them after the fact instead of changing the design as it is made.
- **Placeholder as label.** A label that disappears the moment the field is filled.
- **Validation mid-keystroke.** Errors thrown before the user finishes a field.
- **Lost work on failure.** Clearing the form when a submit fails.
- **Confirmation-dialog overuse.** "Are you sure?" on routine reversible actions, training the reflexive click.
- **Asking for the known.** Requiring data the system already has or could derive.
- **Scentless labels.** "Click here" / "Next" predicting nothing about the destination.
- **Dead-end screens.** A view a user can reach but not leave, or a flow with no way back.
- **The half-built pattern.** A recognised pattern shipped as a shell — a filter pill that does not remove, a skeleton that never resolves.
