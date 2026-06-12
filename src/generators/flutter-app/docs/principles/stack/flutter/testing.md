---
title: Testing
description: Unit, widget, and integration test taxonomy; headless Android emulator CI; Patrol for native boundaries; alchemist goldens; the prove-once rule.
status: active
last_reviewed: 2026-06-12
---
# Testing

## TL;DR

Three tiers: pure-Dart unit tests with fakes, widget tests as the bulk of coverage, and `integration_test` happy paths on a headless Android emulator as the CI-canonical loop. Patrol enters only when a flow crosses the Flutter/OS boundary. Goldens run via alchemist. Surface tests assert wiring, rendering, and interaction — they never re-prove business logic already proven at the core's contract.

## Why this matters

Flutter's first-party test harness is the reason Flutter is GroundWork's mobile pick: `flutter test` runs widget tests headless in seconds, and `integration_test` drives the real app on a headless emulator — the agent runs generate → boot → test → observe without a human holding a device. The agent-closable loop axis lives or dies in this file. Every choice below protects that loop: fakes over mocks keep unit tests refactor-stable, the emulator lane stays thin because surface tests are wiring-only, and iOS never gates CI because an iOS simulator needs macOS runners and hands.

## The prove-once principle

Capability behaviour is proven once, headless, at the core's contract. The Flutter surface proves only that it is **wired** to the core (the typed client is called with the right inputs), **renders** core state correctly, and **handles interaction** (commands fire, navigation moves, errors surface). A widget or integration test that re-asserts a business rule — price calculation, permission logic, validation semantics — is a review finding: it duplicates a proof that already exists at the contract and couples the surface suite to core internals. This is what keeps N surfaces affordable.

## The tiers

### Tier 1 — Unit tests (pure Dart)

View models, repositories, mappers — anything with logic and no widget. Dependencies are substituted with **fakes, not mocks** (the official guide strongly recommends this): an in-memory `FakeUserRepository` implementing the abstract class survives refactors that stub-and-verify mocks break on, and it doubles as the fixture for widget tests. Riverpod's `ProviderContainer` with overrides is the seam (see [State management](state-management.md)).

### Tier 2 — Widget tests (the bulk)

Most coverage lives here. `testWidgets` pumps the feature's View inside a `ProviderScope` with fake repositories, then asserts rendering and interaction through the semantics tree:

```dart
testWidgets('renaming updates the profile header', (tester) async {
  await tester.pumpWidget(ProviderScope(
    overrides: [userRepositoryProvider.overrideWithValue(fakeRepo)],
    child: const MaterialApp(home: ProfileView()),
  ));
  await tester.enterText(find.bySemanticsLabel('Name'), 'Ada');
  await tester.tap(find.text('Save'));
  await tester.pumpAndSettle();
  expect(find.text('Ada'), findsOneWidget);
  expect(fakeRepo.lastRename, 'Ada');
});
```

Widget tests are fast, headless, and deterministic — they are the mobile analogue of the web stack's component tests, and they carry the rendering/interaction half of the surface proof. Find by semantics and visible text, not by widget type or internal keys, so tests assert what users perceive.

### Tier 3 — `integration_test` (happy-path E2E, CI-canonical)

A small set of happy-path flows through the real app binary — launch, sign in against a faked or staged core, exercise one flow per critical journey. These run **on a headless Android emulator in CI**: the standard pattern is `reactivecircus/android-emulator-runner@v2` (x86_64, `-no-window -gpu swiftshader_indirect -no-snapshot-load -no-snapshot-save`, KVM-enabled runner) executing `flutter test integration_test`.

**Android is the CI gate; iOS is a local-only lane.** The headless Android emulator is cheap, scriptable, and agent-drivable; iOS simulators need macOS runners and routinely need hands — putting them in the gate trades the agent-closable loop for platform symmetry the wiring proof does not need. iOS-specific verification happens locally or on device farms (Firebase Test Lab, Codemagic) as an explicit, non-gating lane.

Keep this tier thin. Every integration test is minutes of emulator time; if a widget test can carry the assertion, it does.

### Patrol — only across the Flutter/OS boundary

**Patrol** (LeanCode) is added only when a flow leaves Flutter for the OS: permission dialogs, push notifications, system sign-in sheets, WebViews, home-button/recents behaviour — surfaces `integration_test` structurally cannot touch. It also brings full test isolation and sharding. A Patrol suite duplicating pure-Flutter flows that `integration_test` already covers is scope creep; the boundary is the OS, not preference for its finder DSL.

### Golden tests — alchemist

Goldens guard design-system-level components (the token-projected theme made visible). Use **alchemist**, with its platform-test vs CI-test split — CI variants render text as blocks, killing the cross-platform font flakiness that made goldens a deletion candidate. `golden_toolkit` is discontinued — legacy; migrate, do not adopt. Golden scope is the component library, not full screens: screen-level goldens churn on every copy change and teach the team to rubber-stamp diffs.

## Legacy

`flutter_driver` (long deprecated for `integration_test`); `golden_toolkit`; Appium-first Flutter testing (a mixed-stack-org accommodation, not Flutter-native practice).

## Anti-patterns

- **Re-proving core logic on the surface.** The contract suite already proved it; the surface proves wiring.
- **Mock-heavy unit tests.** Stub-and-verify mocks test the mock's script. Fakes test behaviour.
- **iOS simulator as a CI gate.** It breaks the headless loop; keep it a local or device-farm lane.
- **Fat integration suites.** Emulator minutes are the most expensive test currency in this stack; spend them on happy paths only.
- **Finding by widget type or implementation keys.** Tests coupled to the widget tree break on refactor; semantics-based finds break on user-visible regressions only.
- **`pumpAndSettle` as a sleep.** If a test needs settling tricks to pass, the awaited state is not modelled; assert on it explicitly.
