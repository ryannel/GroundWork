---
title: Widgets and Composition
description: Composition over inheritance, const discipline, build purity, keys, token-projected theming, go_router navigation, and the accessibility baseline.
status: active
last_reviewed: 2026-06-12
---
# Widgets and Composition

## TL;DR

Widgets compose; they do not inherit. Build methods are pure, `const` is applied wherever the constructor allows, keys are used deliberately, and every colour, radius, and text style flows from a `ThemeData` module generated from the design system's brand tokens — never hand-rolled. Navigation is go_router with typed routes via `go_router_builder`. Accessibility is a merge gate, not a backlog item.

## Why this matters

Flutter's rendering model rewards exactly one style: small, pure, const-friendly widgets composed deeply. Every deviation — subclassed widgets, side effects in build, hardcoded colours — is a deviation an agent must special-case forever after. Keeping the widget layer mechanical is what keeps it cheap.

## The principles

### Composition over inheritance

New UI is built by composing existing widgets, never by subclassing a widget to alter its behaviour. A "PrimaryButton" wraps and configures; it does not extend. Extract a widget when a build method's subtree is reused or when it can become `const` — extraction into widgets (not helper methods returning widgets) is what gives Flutter subtree-level rebuild isolation.

### `const` discipline

Every widget constructor that can be `const` is `const`, and every instantiation site that can use `const` does. A `const` widget is canonicalised and skipped during rebuilds — this is the cheapest performance work in Flutter, it is enforced by lints (`prefer_const_constructors` and friends in `flutter_lints`), and it costs nothing at authoring time.

### Build purity

`build` reads state and returns widgets. It never mutates state, fires requests, shows dialogs, or starts animations — Flutter may call build at any frequency, and an impure build turns rebuild cadence into behaviour. Side effects belong in view-model commands, lifecycle hooks, or listeners.

### Keys are deliberate

Keys appear in exactly three situations: reordering children in lists (`ValueKey` on the item id), preserving state when the tree shape changes around a stateful widget, and `GlobalKey` for the rare imperative handle (forms). A key sprinkled "to be safe" is noise; a missing key on a reorderable list is a state-corruption bug.

### Theming is a projection, not an authoring surface

A GroundWork app's theme module is **generated from `brand-tokens.json`** — the design system's token file projects into a Dart theme module exposing `ThemeData` (and any semantic extensions via `ThemeExtension`). Widgets consume `Theme.of(context)` and the generated extensions; they never declare `Color(0xFF...)`, raw `TextStyle`s, or magic paddings. This is the one-design-system-projection dividend of the capability-core model: the same tokens drive every surface, so cross-surface visual consistency is a build artifact, not a review hope. A hex literal in a widget file is a review finding.

Note for planning: Material and Cupertino are frozen in the core framework as of Flutter 3.44, moving to standalone `material_ui`/`cupertino_ui` packages — theme code should expect that dependency shift.

### Navigation is go_router, typed

**go_router** (flutter.dev verified publisher, declared feature-complete — a stable platform piece, not a moving target) is the router:

- **Typed routes via `go_router_builder`** — route paths and parameters as generated, compile-checked classes. Stringly-typed `context.go('/user/$id')` calls scattered through features are the navigation equivalent of hand-rolled JSON.
- **`StatefulShellRoute`** for bottom-bar/tab scaffolds with per-tab navigation state.
- **Centralised `redirect`** for auth guards — one function, not per-screen checks.
- **Deep links fall out for free**: anything declared as a `GoRoute` is deep-linkable, which is also why the route is a first-class state container.

Raw Navigator 1.0 push/pop survives only for trivial local flows (a dialog, a one-off modal). Hand-rolled Navigator 2.0 `RouterDelegate` code is legacy — it is the API go_router exists to hide.

### Accessibility is a baseline

Every interactive widget has a semantic label (`Semantics`, `Tooltip`, or the widget's built-in semantics), tap targets meet the 48dp minimum, contrast meets WCAG AA via the token palette (enforced at the design-system layer, inherited here), and dynamic type does not break layouts — test at large text scales. Flutter's semantics tree is also the test seam: widget tests find by semantics, so inaccessible UI is untestable UI. Accessibility failures block merges.

## Anti-patterns we reject

- **Helper methods returning widget subtrees.** `Widget _buildHeader()` defeats const canonicalisation and rebuild isolation. Extract a widget class.
- **Hardcoded colours, text styles, or spacing.** The theme module is generated from tokens; literals fork the design system silently.
- **`MediaQuery.of(context).size` for layout decisions.** Use `LayoutBuilder` — MediaQuery couples a widget to the screen, not its parent's constraints.
- **Logic in build.** Conditionals that encode business rules belong in the view model; build renders state.
- **Stringly-typed navigation.** Generated route classes exist; use them.
- **GlobalKeys as state plumbing.** A GlobalKey reaching into another widget's state is a view model that wasn't written.

## Further reading

- [Flutter widget docs](https://docs.flutter.dev/ui) — the composition mental model.
- [go_router](https://pub.dev/packages/go_router) and [go_router_builder](https://pub.dev/packages/go_router_builder) — routing and typed routes.
- [Flutter accessibility](https://docs.flutter.dev/ui/accessibility-and-internationalization/accessibility) — the semantics tree and platform integrations.
