---
title: State Management
description: Riverpod 3.x providers, Notifiers, Mutations, ephemeral vs app state, testing seams, and the legacy patterns we name and refuse.
status: active
last_reviewed: 2026-06-12
---
# State Management

## TL;DR

Riverpod 3.x is the default. Providers hold shared and derived state, `Notifier` classes hold state with behaviour, Mutations carry the lifecycle of user actions, and `setState` survives only for ephemeral widget-local state. Tests exercise providers in a `ProviderContainer` with overrides — no widget tree required. Provider-as-state-management, setState-as-architecture, and GetX are legacy.

## Why this matters

State management is where Flutter codebases historically rotted: a package chosen by fashion, state scattered between widgets and singletons, and tests that need a full widget pump to assert a counter incremented. Riverpod's compile-safe provider graph fixes the structural problems — no `BuildContext` dependency for reads, no runtime lookup failures, and a DI story for free — which is why it is the converging 2026 default for new builds and our pick. Pin 3.x APIs conservatively: persistence is experimental and the maintainer flags a possible 4.0.

## The patterns

### Providers are the graph

Everything shared is a provider: repositories, services, the contract client, derived view state. The provider graph **is** the dependency-injection graph — a view model provider `ref.watch`es its repository provider, the repository provider reads the client provider. Construction order, disposal, and test substitution all fall out of the graph; there is no separate DI container.

```dart
final userRepositoryProvider = Provider<UserRepository>(
  (ref) => UserRepository(ref.watch(apiClientProvider)),
);
```

### Notifier for state with behaviour

A view model is a `Notifier` (or `AsyncNotifier` when the initial state is asynchronous) exposing an immutable state object and methods as the MVVM commands:

```dart
class ProfileViewModel extends AsyncNotifier<ProfileState> {
  @override
  Future<ProfileState> build() async =>
      ProfileState(user: await ref.watch(userRepositoryProvider).current());

  Future<void> rename(String name) async { /* command */ }
}
```

`build` declares dependencies via `ref.watch`; when a dependency changes, the state recomputes. Derived read-only state uses plain providers over Notifiers — do not write a class where a function suffices.

### Mutations for action lifecycle

User actions that need pending/success/error surfacing — submit, delete, retry — use Riverpod 3 **Mutations** (idle/pending/success/error, no codegen required). They replace the hand-rolled `isLoading` boolean and the per-action `AsyncValue` juggling; the view watches the mutation state and renders the spinner or the error.

### What is state, and what is ephemeral

A provider holds state that is **shared, derived from the core, or must survive the widget's lifetime**: session, fetched data, feature view state. `setState` in a `StatefulWidget` is correct for **ephemeral** state — text-field focus, animation progress, whether a tile is expanded — where lifting it into a provider adds graph noise for state nobody else reads. The boundary question: does anything outside this widget care? No → ephemeral.

Client state must also be recoverable: anything not rebuildable from the core or the route is state the app loses on process death, and mobile processes die constantly. The route (go_router's URL) is a first-class state container.

### Testing seams

Providers test without widgets. A `ProviderContainer` with overrides substitutes fakes at any node of the graph:

```dart
final container = ProviderContainer(overrides: [
  userRepositoryProvider.overrideWithValue(FakeUserRepository()),
]);
final state = await container.read(profileViewModelProvider.future);
```

Fakes over mocks, per the official guide: an abstract repository with an in-memory fake survives refactors that a stubbed mock breaks on. Widget tests override the same providers via `ProviderScope(overrides: ...)` — the same seam serves both tiers.

## Legacy patterns — named so they are refused

- **provider-as-state-management.** The 2019–2022 default. Riverpod is its designated successor by the same author; `provider` survives officially only as a DI mechanism, and with Riverpod even that role is subsumed.
- **setState-as-architecture.** `StatefulWidget`s holding app state, passed down constructors, mutated in callbacks. Legacy for anything beyond ephemeral state.
- **GetX.** Uniformly an anti-recommendation in serious 2026 comparisons — global mutable service locators and context-free magic that defeats both the type system and testability. Never.
- **Riverpod experimental persistence.** Not legacy but forbidden for now: explicitly experimental, and we do not put experimental APIs in load-bearing paths.

## Anti-patterns

- **Reading providers in `build` methods imperatively.** `ref.watch` in build, `ref.read` only inside callbacks. A `ref.read` in build silently opts out of reactivity.
- **Provider state that mirrors the route.** If go_router already encodes it (selected id, tab), the provider duplicating it will drift.
- **One god-provider per screen.** Split by concern; the graph dedupes and recomputes at the right granularity only if you let it.
- **Mocking your own Notifier.** Test the real Notifier with fake repositories; mocking the unit under test proves nothing.

## Further reading

- [riverpod.dev](https://riverpod.dev) — the official docs; the "what's new in 3.0" page covers Mutations.
- [Flutter architecture recommendations](https://docs.flutter.dev/app-architecture/recommendations) — fakes-over-mocks and the command pattern this document assumes.
