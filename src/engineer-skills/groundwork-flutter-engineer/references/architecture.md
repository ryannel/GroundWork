# Architecture

## The Layer Model

This codebase follows the official Flutter architecture: a **UI layer** of MVVM features over a **data layer** of repositories and services. A Domain layer of use-cases exists only where it has earned its place. Dependency direction is strict and single-direction:

```
View  →  ViewModel  →  Repository (abstract)  →  Service (ApiClient, platform APIs)
                              ↓
                       domain models
```

- A View never imports a repository, a service, or `dio`.
- A ViewModel never imports widgets or `BuildContext`.
- A repository never imports another repository — cross-repository orchestration belongs in a view model (or an earned use-case).
- Services are stateless and never aware of repositories.

The app is a **surface adapter** over the workspace's capability core. Business rules live behind the promoted contracts and are proven there; if you find yourself implementing a pricing rule, a permission check, or validation semantics in Dart, stop — that logic belongs in the core, and the surface renders its results.

---

## File Organization

`ui/` is feature-first; `data/` and `domain/` are type-first:

```
lib/
├── main.dart                  # ProviderScope root — nothing else
├── app.dart                   # MaterialApp.router + theme wiring
├── router.dart                # the go_router route table
├── config/app_config.dart     # --dart-define configuration
├── ui/
│   ├── core/theme/            # generated palette + theme builder
│   └── <feature>/
│       ├── <feature>_view.dart
│       └── <feature>_view_model.dart
├── data/
│   ├── repositories/          # <entity>_repository.dart: abstract + impl
│   └── services/              # api_client.dart, platform service wrappers
└── domain/
    └── models/                # immutable models
```

Naming is the official convention and is load-bearing — predictable names are how the next agent finds the right file on the first try: `HomeView`/`HomeViewModel`, `UserRepository`/`RemoteUserRepository`, `AuthService`. Do not invent variants (`HomeScreen`, `HomeController`, `UserStore`).

For large apps, split features into local packages with Dart pub workspaces (`resolution: workspace`); Melos 7.x (configured under the `melos:` key in the root pubspec) handles scripts and versioning. Layer-first roots (`/screens`, `/widgets`, `/models`) are legacy — do not recreate them.

---

## Views and ViewModels

Every feature is exactly one View paired with exactly one ViewModel.

**The View** is widgets only — layout, animation, conditional rendering, simple navigation calls. It watches its view model provider and dispatches commands:

```dart
class ProfileView extends ConsumerWidget {
  const ProfileView({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(profileViewModelProvider);
    return state.when(
      loading: () => const CircularProgressIndicator(),
      error: (e, _) => ErrorPanel(error: e),
      data: (profile) => ProfileBody(
        profile: profile,
        onRename: (name) =>
            ref.read(profileViewModelProvider.notifier).rename(name),
      ),
    );
  }
}
```

**The ViewModel** is an `AsyncNotifier` (or `Notifier` for synchronous state) exposing an immutable state object and methods as commands:

```dart
class ProfileViewModel extends AsyncNotifier<ProfileState> {
  @override
  Future<ProfileState> build() async {
    final user = await ref.watch(userRepositoryProvider).current();
    return ProfileState(user: user);
  }

  Future<void> rename(String name) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final user = await ref.read(userRepositoryProvider).rename(name);
      return ProfileState(user: user);
    });
  }
}
```

Red flags: a `build` method with an `if` on a domain rule; a view model importing `material.dart`; a widget calling a repository.

---

## Repositories and Services

**Repositories** are the source of truth. They own caching, retry, polling, and translating contract payloads into domain models. Always an abstract class plus an implementation, exposed as a provider:

```dart
abstract class OrderRepository {
  Future<List<Order>> recent();
  Stream<Order> watch(String id);
}

class RemoteOrderRepository implements OrderRepository {
  RemoteOrderRepository(this._client);
  final ApiClient _client;
  // translate contract DTOs → domain models here, nowhere else
}

final orderRepositoryProvider = Provider<OrderRepository>(
  (ref) => RemoteOrderRepository(ref.watch(apiClientProvider)),
);
```

The abstract class is the test seam: an in-memory `FakeOrderRepository` serves unit and widget tests without a mocking framework.

**Services** are stateless wrappers over external interfaces — the contract client, platform APIs (via Pigeon), local storage — exposing `Future`/`Stream`. They hold no app state and know nothing about repositories or features.

---

## The Core-Access Seam

The typed contract client lives in `data/services/` and is consumed only by repositories:

- The client is **thin and hand-rolled while the contract surface is small**: one method per promoted-contract operation, typed models in `domain/models/`. (This is the recorded tooling stance; see `references/data-and-contracts.md`.)
- When the promoted `openapi.yaml` grows past a handful of operations, switch to generated clients (`openapi_generator` dart-dio) — the repositories keep their shape, so nothing above the data layer changes.
- **Nothing above the data layer knows the transport.** A view model cannot tell whether the core is REST or gRPC, hosted or embedded. If a view model is constructing URLs or reading `DioException`s, the seam has leaked.

---

## Domain Models and Immutability

Domain models are immutable. Plain `const` classes suffice while models are trivial; introduce **freezed** when models carry real shape — unions, `copyWith`, exhaustive matching, JSON round-trips — because at that point its codegen earns the build_runner step:

```dart
@freezed
sealed class Order with _$Order {
  const factory Order.draft({required String id}) = DraftOrder;
  const factory Order.placed({required String id, required DateTime at}) = PlacedOrder;
  factory Order.fromJson(Map<String, dynamic> json) => _$OrderFromJson(json);
}
```

Never add a mutable field to a domain model to "simplify" an update path — that is the unidirectional flow breaking.

---

## When a Domain Layer Is Earned

Add a use-case class only when at least one of these is true:

1. Logic **merges multiple repositories** (and would otherwise live awkwardly in one view model).
2. The logic is **genuinely complex** and burying it in a view model harms testability.
3. The logic is **reused across view models**.

A use-case that forwards a single repository call is indirection tax — delete it. Default is two layers.

---

## Placement Checklist

Before creating a file, answer:

| The code... | It goes in |
|---|---|
| renders widgets | `ui/<feature>/<feature>_view.dart` |
| holds feature state / handles user events | `ui/<feature>/<feature>_view_model.dart` |
| decides which data is the truth (cache, retry, merge) | `data/repositories/` |
| talks to the network, OS, or storage | `data/services/` |
| is a value the app passes around | `domain/models/` |
| is a business rule | the capability core, not this app |
