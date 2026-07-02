# Version Corrections

Where the model's training data is stale. This file is a checklist, not a tutorial — each item names what changed, why it bites, and the minimal fix. Verify against `pubspec.yaml` and the pinned Flutter SDK before applying; a project on an older Flutter may not carry all of these yet.

## Material/Cupertino are frozen in the core framework (Flutter 3.44)

Material and Cupertino are frozen in core and moving to standalone `material_ui`/`cupertino_ui` packages with independent versioning. When those packages land in this app's pubspec, pin them deliberately and review the theme builder against their migration notes — expect the dependency shift; do not be surprised by it. Theme mechanics: `references/theming-and-design-tokens.md`.

## Swift Package Manager is the iOS/macOS default (Flutter 3.44)

New native modules and plugin dependencies use SwiftPM; CocoaPods is the legacy path kept only where a required dependency has not migrated. Training data defaults to Podfile wiring — do not add new Podfile-based wiring. Build wiring: `references/platform-channels.md` → iOS Build Wiring.

## Channel-free interop is mid-migration

`ffigen` (C/Obj-C/Swift) is stable; `jnigen` (Java/Kotlin via JNI) is pre-1.0; both ride build hooks / native assets, default-enabled since Flutter 3.38. Pigeon remains the app-code default until the jnigen path reaches 1.0 — adopt codegen interop where a dependency already ships it. The stance in full: `references/platform-channels.md`.

## Riverpod 3 shapes, not Riverpod 1/2 idiom

`Notifier`/`AsyncNotifier` are the provider shapes; `StateNotifier`, `StateProvider`, and `ChangeNotifierProvider` are legacy idiom training data still emits. Pending/success/error surfacing uses Riverpod 3 **Mutations**, not hand-rolled `isLoading` booleans. Patterns: `references/state-management.md`.
