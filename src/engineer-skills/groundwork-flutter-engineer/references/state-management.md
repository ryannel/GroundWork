# State Management

## The Rules

1. **Riverpod 3.x** is the state-management and DI mechanism. One tool for both; no second container.
2. Everything shared is a provider; everything provider-shaped is testable through overrides.
3. Pin 3.x conservatively — the experimental offline-persistence API never enters load-bearing paths.
4. `setState` survives only for ephemeral widget-local state.

---

## Providers Are the Graph

Repositories, services, the contract client, view models, and derived state are all providers. The provider graph **is** the dependency-injection graph:

```dart
final apiClientProvider = Provider<ApiClient>((ref) => ApiClient(/* ... */));

final userRepositoryProvider = Provider<UserRepository>(
  (ref) => RemoteUserRepository(ref.watch(apiClientProvider)),
);

// Derived read-only state: a plain provider, not a class.
final unreadCountProvider = Provider<int>(
  (ref) => ref.watch(inboxViewModelProvider).valueOrNull?.unread.length ?? 0,
);
```

Construction order, disposal, and test substitution fall out of the graph. Do not write a `Notifier` class where a derived provider (a function) suffices.

`ProviderScope` at the root of `main.dart` is the only composition root. There is no `get_it`, no manually threaded constructors across features, no `InheritedWidget` plumbing for app state.

---

## Notifier and AsyncNotifier

A view model is a `Notifier` (synchronous initial state) or `AsyncNotifier` (asynchronous initial state). `build` declares dependencies with `ref.watch` — when a dependency changes, state recomputes:

```dart
class InboxViewModel extends AsyncNotifier<InboxState> {
  @override
  Future<InboxState> build() async {
    final messages = await ref.watch(messageRepositoryProvider).inbox();
    return InboxState(messages: messages);
  }

  // Commands: the only way the view mutates anything.
  Future<void> archive(String id) async {
    await ref.read(messageRepositoryProvider).archive(id);
    ref.invalidateSelf(); // re-derive from the source of truth
  }
}

final inboxViewModelProvider =
    AsyncNotifierProvider<InboxViewModel, InboxState>(InboxViewModel.new);
```

Prefer `ref.invalidateSelf()` (re-derive from the repository) over hand-patching state when the repository is cheap to re-read — hand-patched state drifts from the source of truth.

In views, render `AsyncValue` exhaustively:

```dart
final state = ref.watch(inboxViewModelProvider);
return state.when(
  loading: () => const InboxSkeleton(),
  error: (e, _) => ErrorPanel(error: e, onRetry: ...),
  data: (inbox) => InboxList(inbox: inbox),
);
```

Never `.valueOrNull!` your way past the loading and error cases in a view.

---

## Mutations for Action Lifecycle

User actions that need pending/success/error surfacing — submit, delete, retry — use Riverpod 3 **Mutations** instead of hand-rolled `isLoading` booleans:

```dart
final archiveMessage = Mutation<void>();

// In the view model / command site:
archiveMessage.run(ref, (tsx) async {
  await tsx.get(messageRepositoryProvider).archive(id);
});

// In the view:
final archiveState = ref.watch(archiveMessage);
// idle / pending / success / error — render the spinner or the failure from this.
```

One mutation per user action. If you are writing `bool _submitting` into a state class, reach for a Mutation instead.

---

## App State vs Ephemeral State

The boundary question: **does anything outside this widget care?**

| State | Mechanism |
|---|---|
| Session, fetched data, feature view state | provider / Notifier |
| Selected tab, selected entity id, current screen | the **route** (go_router) — never duplicated in a provider |
| Text-field focus, animation progress, tile expanded | `setState` in a `StatefulWidget` |

Two corollaries:

- **Route-mirroring providers drift.** If go_router already encodes it, read it from the route.
- **State must be recoverable.** Mobile processes die constantly; anything not rebuildable from the core or the route is state the app silently loses. Design state so `build()` can reconstruct it.

---

## ref.watch vs ref.read

- `ref.watch` — in `build` methods (Notifier and widget alike). Declares a reactive dependency.
- `ref.read` — inside callbacks and commands only. A `ref.read` in `build` silently opts out of reactivity and is a bug even when it appears to work.
- `ref.listen` — for side-effects on state change (showing a snackbar on error) — never for deriving state.

---

## Testing Providers

Providers test without widgets. `ProviderContainer` plus overrides substitutes fakes at any node:

```dart
test('archiving removes the message from inbox state', () async {
  final fakeRepo = FakeMessageRepository(seed: [message1, message2]);
  final container = ProviderContainer(
    overrides: [messageRepositoryProvider.overrideWithValue(fakeRepo)],
  );
  addTearDown(container.dispose);

  await container.read(inboxViewModelProvider.future);
  await container.read(inboxViewModelProvider.notifier).archive(message1.id);

  final state = await container.read(inboxViewModelProvider.future);
  expect(state.messages, [message2]);
});
```

Widget tests use the same seam through `ProviderScope(overrides: [...])`. Test the **real Notifier with fake repositories** — mocking the Notifier itself proves nothing. Fakes over mocks throughout (see `references/testing.md`).

---

## Refused Packages and Patterns

These are named so they are recognised and refused in review:

- **GetX** — global mutable service locators, context-free magic. Never, in any role.
- **provider as state management** — the 2019–2022 pattern; Riverpod is its successor by the same author. With Riverpod, even provider's DI role is subsumed — do not run both.
- **setState as architecture** — app state in `StatefulWidget`s threaded through constructors.
- **Riverpod experimental persistence** — explicitly experimental; not in load-bearing paths.
- **Bloc** — not wrong, but a deliberate alternative for regulated/large-team contexts. Adopting it is a recorded decision, not a drift; never mix it with Riverpod in one app.
- **One god-provider per screen** — split by concern; the graph recomputes at the right granularity only if you let it.
