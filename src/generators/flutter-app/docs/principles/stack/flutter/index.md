---
title: Flutter
description: Architecture, state management, widgets, testing, native interop, and release engineering for Flutter mobile surfaces.
status: active
last_reviewed: 2026-06-12
---
# Flutter

## TL;DR

A GroundWork mobile surface is a Flutter app: MVVM over a two-layer architecture, Riverpod for state, go_router for navigation, widget tests as the bulk of coverage, Pigeon for native interop, and a CI pipeline that signs, versions, and ships to both stores without a human in the loop. The surface is a thin adapter — business logic lives in the capability core and is reached through a typed client over promoted contracts.

## Scope

This set is named for the framework, not the language, because the engineering knowledge that matters is platform knowledge: widget lifecycles, store signing, emulator CI, platform channels. Dart idioms appear only where they carry a platform decision (immutability, codegen). The set covers mobile surfaces; Flutter-desktop and Flutter-web are out of scope — GroundWork's standard picks route those platforms elsewhere (see [surface stack selection](../../surface-stack-selection.md)).

## Toolchain currency

**Flutter 3.44.0 stable / Dart 3.12.0** (May 2026). Notable for planning: Material and Cupertino are frozen in the core framework as of 3.44 and are moving to standalone `material_ui`/`cupertino_ui` packages with independent versioning — pin them deliberately when they land.

## The set

- **[Architecture](architecture.md)** — the two-layer (UI/Data, optional Domain) model from the official Flutter architecture guide: MVVM in the UI layer, repositories and services in the data layer, feature-first `ui/` with type-first `data/`, immutable models via `freezed`, and the core-access seam — how the surface reaches the capability core through a typed contract client. States the GroundWork state-management default (Riverpod 3.x) and why.
- **[State management](state-management.md)** — Riverpod 3.x in depth: provider and Notifier patterns, Mutations for action lifecycle, what belongs in providers versus ephemeral widget state, and the testing seams (`ProviderContainer`, overrides). Names the legacy patterns — provider-as-state-management, setState-as-architecture, GetX — so they are recognised and refused.
- **[Widgets and composition](widgets-and-composition.md)** — composition over inheritance, `const` discipline, build-method purity, keys, theming as a projection of `brand-tokens.json` into a generated `ThemeData` module, go_router navigation with typed routes, and the accessibility baseline.
- **[Testing](testing.md)** — the unit/widget/integration taxonomy: pure-Dart unit tests with fakes, widget tests as the bulk, `integration_test` happy paths on a headless Android emulator as the CI-canonical loop, Patrol only where flows cross the Flutter/OS boundary, and golden tests via alchemist. Surface tests prove wiring, never re-prove core logic.
- **[Platform channels](platform-channels.md)** — the native escape hatch: Pigeon for structured APIs today, ffigen/jnigen with build hooks as the tracked destination, raw `MethodChannel` only for trivial one-offs, and when dropping to Swift/Kotlin is justified.
- **[Releases and distribution](releases-and-distribution.md)** — signing discipline on both stores, CI/CD with GitHub Actions + fastlane (Codemagic as the Flutter-native alternative), pubspec versioning, the backend-driven forced-upgrade floor that makes contract compatibility enforceable on a lagging mobile fleet, and Shorebird code push for Dart-only OTA patches.

## Survey provenance

This set was authored from a dated ecosystem survey, not from prior assumption. A future refresh supersedes this provenance block.

**Survey date: 2026-06-12.** Load-bearing sources:

- Official: [docs.flutter.dev/app-architecture/guide](https://docs.flutter.dev/app-architecture/guide) and [/recommendations](https://docs.flutter.dev/app-architecture/recommendations) (both updated 2026-05-05); Flutter 3.44 release notes and announcement (May 2026); [Flutter's path towards seamless interop](https://blog.flutter.dev/flutters-path-towards-seamless-interop-4bf7d4579d9a); [dart.dev/tools/pub/workspaces](https://dart.dev/tools/pub/workspaces) and [dart.dev/tools/hooks](https://dart.dev/tools/hooks); docs.flutter.dev deployment, integration-test, and bind-native-code pages.
- Packages (versions checked 2026-06-12 on pub.dev): go_router 17.3.0 and pigeon 27.1.0 (flutter.dev verified publisher), patrol 4.6.1 (LeanCode), riverpod 3.0.x changelog + riverpod.dev "what's new", flutter_bloc 9.1.1, alchemist, upgrader, shorebird_code_push, openapi_generator.
- Ecosystem: Very Good Ventures (flutter_bloc rationale, Very Good Core, alchemist tutorial); Codemagic docs (code signing, Shorebird publishing); ReactiveCircus android-emulator-runner; Code With Andrea project-structure guidance; 2026 state-management comparisons (foresightmobile, startdebugging.net, dasroot.net).
