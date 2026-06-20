---
title: Interaction & Motion
description: Affordance and feedback, the full set of interface states, motion that serves function, and perceived performance as a design material.
status: active
last_reviewed: 2026-06-20
---
# Interaction & Motion

## TL;DR

An interface communicates what it can do and what just happened. Every actionable element signals its affordance; every action gets immediate feedback. Every surface that fetches or mutates data is designed for its full set of states — empty, loading, partial, error, success, populated — not just the happy path. Motion serves a function or is cut, runs on physics, and respects the user's reduced-motion preference. Speed is designed: perceived performance is a material the designer shapes, not a number the backend hands over.

## Why this matters

The states a user actually lives in — the first-run empty screen, the slow load, the failed submit — are where products are won or lost, and they are exactly the states an engineering-led build leaves to fall out of the code. A blank panel on first use teaches nothing; a generic toast on failure with the form wiped loses trust irrecoverably. Motion compounds the effect either way: purposeful motion explains cause and continuity, while decorative motion on a hundred-times-a-day action becomes friction. And because users judge speed by feel, an interface that acts optimistically and streams partial results feels fast even when the network is not.

## Our principles

### 1. Affordance is signalled; feedback is immediate

Every actionable element carries a perceptible signifier — shape, weight, underline, cursor, label — because an affordance the user cannot perceive does not exist for them, and a non-interactive element avoids signifiers that imply action. Every action produces a response within ~100ms, proportional to the action and located at its point, because users build a correct mental model only from feedback they can see. Control layout maps to effect: arrangement mirrors what it changes, and a toggle's state is unambiguous.

### 2. Design every state, not the happy path

Every surface that loads or changes data is designed for six states: **empty** (first-use teaches what goes here and offers one action; distinguish first-use from user-cleared from no-results), **loading** (skeleton matching the final layout for content, spinner for short waits, determinate progress past ~1s), **partial** (render what is here and stream the rest), **error** (in-context, specific, recoverable, with the user's input preserved), **success** (confirm clearly — this is the remembered "end"), and **populated** (the ideal, which must survive real data extremes — long strings, huge counts, missing fields). Designing only the populated state is the most common production failure.

### 3. Motion serves a function or it is cut

Every animation justifies itself against one of four jobs — feedback (confirm an action registered), continuity (move rather than teleport, preserving the user's spatial model), focus (direct the eye to what changed), or perceived performance (an ease-out entrance feels faster) — and motion that serves none is removed. High-frequency and keyboard-initiated actions get *no* animation, because an interface used hundreds of times a day feels fast precisely when it does not animate. Motion is salt: too much spoils the dish.

### 4. Motion runs on physics and stays out of the way

The default transition is `ease-out`, around 200ms, animating only `transform` and `opacity` — compositor-only properties that hold frame rate, where animating `width`/`margin`/`box-shadow` drops frames. `ease-in` is never used on interface elements (it starts slow and feels sluggish); `ease-in-out` is for on-screen movement, `ease-out` for entrances, `linear` only for progress. Springs — tuned by duration and a subtle bounce (≈0.1–0.3) — are preferred for anything grabbable, flingable, or interruptible, because a spring maintains velocity when interrupted while a fixed-duration tween restarts from zero. Elements enter from `scale(0.95)`, never `scale(0)`, because nothing in the real world shrinks to nothing.

### 5. Choreography is restrained; transitions are declarative

A sequence of related elements enters with a short stagger (≈20–50ms) that reads as one gesture with a single focal point, never as everything animating at once. We use the View Transitions API for shared-element and page transitions rather than hand-built FLIP, because it captures before/after snapshots and animates declaratively, is Baseline for same-document transitions, and degrades to a clean cut where unsupported. Each animated element carries its own `view-transition-name`, and heavy cross-fades over large subtrees are avoided.

### 6. Speed is designed: perceived performance is a material

We budget feedback to the perceptual thresholds — under ~100ms feels instantaneous, ~1s holds the flow of thought, ~10s is the limit of attention — and design to them: animate freely below 100ms, show an instant affordance (not a spinner) around 1s, show determinate progress past 10s. Low-risk, high-success mutations are optimistic by default — apply the effect immediately and reconcile in the background, reverting visibly on failure — because acting before the network confirms is what makes an interface feel fast. Spinners are reserved for risky or genuinely slow operations; skeletons are used only when content-shaped and longer than ~1s, and must match the final layout to avoid a flash and a shift.

### 7. Reduced motion is the safe baseline

We author the muted baseline and layer motion inside `prefers-reduced-motion: no-preference`, so the interface fails safe for users with vestibular conditions. Reduced motion means *reduce, not remove* — disable vestibular triggers (parallax, large translations, scale, spin, autoplay) and keep functional feedback (quick fades, focus changes, state transitions), replacing a slide with a cross-fade rather than nuking all motion. Meaning is never carried by motion alone: when motion is reduced, state must still read through colour, text, icon, and layout.

## How we apply this

- [Usability & UX](usability-and-ux.md) — the heuristics and UX laws that govern interaction decisions and form behaviour.
- [Visual Design](visual-design.md) — depth and colour give motion its surfaces and its sense of physical light.
- [Accessibility](../quality/accessibility.md) — reduced motion, focus visibility, and target size as hard constraints on interaction.
- [AI-Native Design](ai-native-design.md) — latency, streaming, and partial-result design for probabilistic features.

## Anti-patterns we reject

- **Happy-path-only.** Shipping the populated state and leaving empty, loading, error, and success to chance — abandoning users exactly where they need the most help.
- **Mystery-meat UI.** Text, links, and buttons made visually indistinguishable, so the user cannot tell what is actionable.
- **`transition: all`.** Animating unintended (and layout-triggering) properties; the default `ease`/`ease-in` curve on interactive UI.
- **Animation on everything.** Decorative motion on high-frequency or keyboard-driven actions, where speed beats polish.
- **Optimism where it is unsafe.** Optimistic updates on irreversible or low-success actions like payments and deletes.
- **Frame-display skeletons.** Skeletons that do not match the real layout, or flash on sub-300ms loads — reading as broken, causing a shift.
- **Motion as the only signal.** State conveyed solely by movement, lost entirely when motion is reduced.

## Further reading

- Don Norman, *The Design of Everyday Things* — affordances, signifiers, feedback, and mapping.
- Emil Kowalski, *Great Animations* — purposeful, interruptible, reduced-motion-aware UI motion.
- Nielsen Norman Group, *Response Times: The 3 Important Limits* — the 0.1s / 1s / 10s perceptual thresholds.
- *Material 3 Motion* — easing and duration tokens, and the spring-based expressive system.
