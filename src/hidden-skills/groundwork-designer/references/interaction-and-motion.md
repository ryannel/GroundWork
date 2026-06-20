# Interaction & Motion

When you advise on interaction, the interface has two jobs: communicate what it can do, and communicate what just happened. The decisions that matter most are the ones an engineering-led build skips — the states the user actually lives in, and motion that earns its place.

## Affordance is signalled; feedback is immediate

Every actionable element carries a perceptible signifier (shape, weight, underline, cursor, label), because an affordance the user cannot perceive does not exist for them; a non-interactive element avoids signifiers that imply action. Every action gets a response within ~100ms, proportional and located at its point, because the user builds a mental model only from feedback they can see.

## Design every state, not the happy path

Every surface that loads or mutates data is designed for six states: **empty** (first-use teaches and offers one action — distinguish first-use from cleared from no-results), **loading** (skeleton matching final layout for content, spinner for short waits, determinate progress past ~1s), **partial** (render what you have, stream the rest), **error** (in-context, specific, recoverable, input preserved), **success** (confirm clearly — the remembered ending), and **populated** (which must survive real data extremes — long strings, huge counts, missing fields). Designing only the populated state is the most common production failure, and the skipped states are where trust is won or lost.

## Motion serves a function or is cut

Every animation justifies itself against feedback, continuity, focus, or perceived performance, and motion that serves none is removed. High-frequency and keyboard-initiated actions get no animation, because an interface used hundreds of times a day feels fast precisely when it does not animate.

## Motion runs on physics and stays out of the way

The default is `ease-out`, ~200ms, animating only `transform` and `opacity` — compositor-only properties that hold frame rate, where `width`/`margin`/`box-shadow` drop frames. `ease-in` is never used on UI (it feels sluggish); springs tuned by duration and a subtle bounce (≈0.1–0.3) are preferred for anything grabbable or interruptible, because a spring keeps velocity when interrupted while a tween restarts from zero. Elements enter from `scale(0.95)`, never `scale(0)`. A related sequence enters with a short stagger (≈20–50ms) reading as one gesture; use the View Transitions API for shared-element and page transitions over hand-built FLIP.

## Speed is designed

Budget feedback to the perceptual thresholds — under ~100ms feels instant, ~1s holds the flow of thought, ~10s is the limit of attention — and design to them. Make low-risk, high-success mutations optimistic: apply the effect immediately and reconcile in the background, reverting visibly on failure, because acting before the network confirms is what feels fast. Reserve spinners for risky or slow operations; use skeletons only when content-shaped and longer than ~1s, matching the final layout.

## Reduced motion is the safe baseline

Author the muted baseline and layer motion inside `prefers-reduced-motion: no-preference`, so it fails safe for vestibular conditions. Reduce, do not remove — disable triggers (parallax, large translations, scale, spin, autoplay), keep functional feedback (quick fades, focus, state), replace a slide with a cross-fade. Meaning never rides on motion alone; when motion is reduced, state still reads through colour, text, icon, and layout.

## Antipatterns to catch

- **Happy-path-only.** Shipping the populated state, abandoning users in empty, loading, and error.
- **Mystery-meat UI.** Text, links, and buttons made visually indistinguishable.
- **`transition: all` and `ease-in`.** Animating layout-triggering properties on a sluggish curve.
- **Animation on everything.** Decorative motion on high-frequency or keyboard actions.
- **Unsafe optimism.** Optimistic updates on irreversible or low-success actions.
- **Frame-display skeletons.** Skeletons not matching the layout, or flashing on sub-300ms loads.
- **Motion as the only signal.** State conveyed solely by movement, lost when motion is reduced.
