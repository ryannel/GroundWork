---
title: Platform Channels
description: Pigeon for structured native APIs, ffigen/jnigen as the tracked destination, when to drop to Swift/Kotlin, and SwiftPM as the iOS default.
status: active
last_reviewed: 2026-06-12
---
# Platform Channels

## TL;DR

Native interop is Pigeon: define the API once in Dart, generate type-safe Kotlin and Swift. The ecosystem is mid-migration to channel-free codegen interop — ffigen/jnigen on build hooks — which we track as the destination but do not adopt for app code until it settles. Raw `MethodChannel` is for trivial one-offs only. Dropping to native is a capability decision, not a performance reflex. iOS native wiring uses Swift Package Manager; CocoaPods is legacy.

## Why this matters

The platform capability ceiling axis says a stack's reach is measured *with* its native escape hatches, because AI labor makes them nearly free — dropping to Swift or Kotlin for one capability is a slice, not a staffing decision. That only holds if the hatch is disciplined: a typed, generated boundary an agent can regenerate and test, not a pile of stringly-typed channel calls that fail at runtime on a misspelled key.

## The interop ladder

### Pigeon — today's default for structured APIs

**Pigeon** (flutter.dev verified publisher) is the production answer for any real native API surface: declare the interface once in a Dart file, generate matching type-safe Kotlin/Swift (and Java/Obj-C/C++) stubs on both sides. Misspelled method names and mistyped arguments become compile errors instead of runtime channel exceptions. Every structured Flutter↔native API in a GroundWork app goes through Pigeon.

### ffigen / jnigen — the tracked destination

The Flutter team's declared direction is **direct codegen interop without channels**: `ffigen` for C/Obj-C/Swift bindings (stable; synchronous calls, tree-shaking), `jnigen` for Java/Kotlin via JNI (pre-1.0, production-usable), built on **build hooks / native assets** (stable since Dart 3.10, default-enabled since Flutter 3.38). The ecosystem is mid-migration: plugin authors are rebuilding on these tools. We name the destination so refactors aim at it, and we adopt it where a dependency already ships it — but Pigeon remains the app-code default until the jnigen path reaches 1.0. Re-evaluate at the next survey.

### Raw `MethodChannel` — trivial one-offs only

A raw channel is acceptable for a single fire-and-forget call with no evolving surface — toggling a platform flag, reading one value. It is not type-safe and not refactorable; the moment a channel grows a second method or a structured payload, it becomes a Pigeon definition. Hand-written channels for any real API surface are legacy.

## When to drop to native

Write Swift/Kotlin when Flutter **cannot reach the capability**: a platform API with no maintained plugin (HealthKit details, platform-specific background modes, a vendor SDK), OS-integrated UI Flutter cannot render (widgets/complications, App Intents), or hardware access below the plugin ecosystem. Do **not** drop to native as a performance reflex — profile first; Flutter's rendering and isolates cover almost every performance complaint, and a native detour taken for imagined speed buys two codebases for one feature.

Check pub.dev before writing native code: a maintained, verified-publisher plugin is a dependency decision, not an interop project. Write native code when the plugin shelf is empty or unmaintained — and structure it as a small, Pigeon-fronted module the agent can regenerate, with the Dart side exposed as a **service** in the data layer like any other platform API (see [Architecture](architecture.md)).

## iOS build wiring

**Swift Package Manager is the iOS/macOS default as of Flutter 3.44.** New native modules and plugin dependencies use SwiftPM; CocoaPods is the legacy path, kept only where a required dependency has not migrated. Do not add new Podfile-based wiring.

## Testing the boundary

The Pigeon-fronted service is faked in Dart for unit and widget tests like any other service — the native side does not run in those tiers. The native implementation itself is exercised by Patrol or `integration_test` on the emulator (see [Testing](testing.md)) only where the capability is observable; pure pass-through wrappers over OS APIs get a thin smoke test, not a re-proof of the OS.

## Anti-patterns we reject

- **Hand-written channels for evolving APIs.** Stringly-typed, runtime-failing, agent-hostile. Pigeon exists.
- **Native-by-reflex for performance.** Profile in Dart first; the ceiling axis funds capability gaps, not superstition.
- **Skipping the plugin shelf.** Rewriting a maintained verified-publisher plugin is negative work.
- **New CocoaPods wiring.** SwiftPM is the default; Pods are a compatibility tail.
- **Native logic that grows business rules.** The native module is transport to an OS capability; rules live in the core or the view model, where they are proven.
