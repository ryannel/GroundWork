# Testing

## Table of Contents
- [The Taxonomy](#the-taxonomy)
- [The Prove-Once Rule](#the-prove-once-rule)
- [Unit Tests](#unit-tests)
- [Widget Tests](#widget-tests)
- [Integration Tests](#integration-tests)
- [Patrol — the OS Boundary Only](#patrol--the-os-boundary-only)
- [Golden Tests](#golden-tests)
- [CI Lanes](#ci-lanes)
- [Test Commands](#test-commands)

---

## The Taxonomy

| Tier | Scope | Runs on | Budget |
|---|---|---|---|
| Unit | view models, repositories, mappers (pure Dart) | anywhere, milliseconds | generous |
| Widget | feature views via `testWidgets` | headless, seconds | **the bulk of coverage** |
| `integration_test` | happy-path E2E through the real binary | headless Android emulator | thin — minutes per test |
| Patrol | flows crossing the Flutter/OS boundary | emulator/device | only when the OS is in the flow |
| Goldens (alchemist) | design-system-level components | CI with text-as-blocks variants | component library only |

Pick the **cheapest tier that can carry the assertion**. If a widget test can prove it, an integration test that proves it is waste.

This taxonomy is the Flutter idiom of the framework testing canon ([`docs/principles/foundations/testing.md`](../../../docs/principles/foundations/testing.md)): widget tests are the fat middle that the canon's honeycomb puts the weight on, unit tests are the thin solitary layer, and `integration_test` is the few-end-to-end top. When this file and the canon disagree, the canon wins and this file is the one to fix.

## The Prove-Once Rule

Capability behaviour is proven once, headless, at the core's contract. The surface suite proves three things only:

1. **Wiring** — the typed client/repository is called with the right inputs.
2. **Rendering** — core state renders correctly (including error and empty states).
3. **Interaction** — commands fire, navigation moves, errors surface.

A widget or integration test re-asserting a business rule (price calculation, permission logic, validation semantics) is a review finding: it duplicates a proof that exists at the contract and couples this suite to core internals.

## Unit Tests

Pure Dart, **fakes over mocks**. An in-memory fake implementing the abstract repository survives refactors that stub-and-verify mocks break on, and doubles as the widget-test fixture:

```dart
class FakeOrderRepository implements OrderRepository {
  FakeOrderRepository({List<Order> seed = const []}) : _orders = [...seed];
  final List<Order> _orders;
  Order? lastPlaced;

  @override
  Future<List<Order>> recent({bool refresh = false}) async => _orders;

  @override
  Future<Order> place(PlaceOrderRequest req) async {
    final order = Order(id: 'fake-${_orders.length}', /* ... */);
    _orders.add(order);
    lastPlaced = order;
    return order;
  }
}
```

View models are tested through `ProviderContainer` with overrides — no widget tree (see `references/state-management.md` for the pattern). Test the real Notifier; never mock the unit under test.

## Widget Tests

The bulk of coverage. Pump the View inside a `ProviderScope` with fake repositories; assert through **semantics and visible text**, not widget types or internal keys:

```dart
testWidgets('placing an order shows the confirmation', (tester) async {
  final fakeRepo = FakeOrderRepository(seed: [draftOrder]);
  await tester.pumpWidget(ProviderScope(
    overrides: [orderRepositoryProvider.overrideWithValue(fakeRepo)],
    child: MaterialApp(theme: buildLightTheme(), home: const OrderView()),
  ));
  await tester.pumpAndSettle();

  await tester.tap(find.bySemanticsLabel('Place order'));
  await tester.pumpAndSettle();

  expect(find.text('Order placed'), findsOneWidget);
  expect(fakeRepo.lastPlaced, isNotNull);
});
```

Conventions:

- Finder priority: `find.bySemanticsLabel` → `find.text` → `find.byTooltip` → `find.byIcon` → (`find.byType`/keys only as a last resort). Semantics-based finds break on user-visible regressions only — and they keep the UI accessible, because inaccessible UI is untestable UI.
- Pump with the real theme (`buildLightTheme()`) so theme extensions resolve; pump both themes for theme-sensitive components.
- Cover error and empty states, not just the happy path — rendering core failure states is half the surface's job.
- `pumpAndSettle` is for settling real transitions, not a sleep. If a test needs settling tricks, the awaited state is not modelled — assert on it explicitly.

## Integration Tests

`integration_test/` drives the real app binary. Keep it to **happy paths, one flow per critical journey**, with the gateway faked or staged:

```dart
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('the app boots to the home view', (tester) async {
    await tester.pumpWidget(ProviderScope(
      overrides: [statusRepositoryProvider.overrideWithValue(FakeStatusRepository())],
      child: const App(),
    ));
    await tester.pumpAndSettle();
    expect(find.text('Wired to the workspace gateway'), findsOneWidget);
  });
}
```

Every integration test costs emulator minutes — the most expensive test currency in this stack. If a widget test can carry the assertion, move it down a tier.

## Patrol — the OS Boundary Only

Add Patrol (LeanCode) only when a flow **leaves Flutter for the OS**: permission dialogs, push notifications, system sign-in sheets, WebViews, home/recents behaviour. It also brings full test isolation and sharding. A Patrol suite duplicating pure-Flutter flows `integration_test` already covers is scope creep — the boundary is the OS, not preference for its `$` finder DSL.

## Golden Tests

Goldens guard **design-system-level components** (the token-projected theme made visible), via **alchemist** with its platform-test vs CI-test split (CI variants render text as blocks, killing font flakiness). Scope is the component library, not full screens — screen-level goldens churn on every copy change and teach rubber-stamping. `golden_toolkit` is discontinued: migrate, never adopt.

## CI Lanes

- **PR gate:** `flutter analyze` + `flutter test` (unit + widget, headless, fast).
- **Boot lane:** `flutter test integration_test` on a headless Android emulator — `reactivecircus/android-emulator-runner@v2`, x86_64, `-no-window -gpu swiftshader_indirect -no-snapshot-load -no-snapshot-save`, KVM-enabled runner.
- **iOS is a local-only / device-farm lane (Firebase Test Lab, Codemagic), never a CI gate** — it needs macOS runners and hands, and putting it in the gate breaks the headless loop.
- A runner without the Flutter SDK reports the tier **skipped-with-reason, never silently green**.

## Assertion Quality — Mutation Testing and Its Absence

The canon's assertion-quality read-out is mutation testing — inject a fault, confirm a test fails. Dart has **no production-grade mutation tool** (the existing packages are experimental and unmaintained), so that automated read-out is not available here. The discipline it enforces is carried by review instead: fakes over mocks (a stub-and-verify mock asserts the call, not the outcome), assert on semantics and visible text rather than widget types, and cover error and empty states — the failure modes mutation testing would otherwise catch. When a dense pure-Dart algorithm genuinely warrants it, a hand-run experimental tool is a spot check, never a gate.

## Test Commands

| Command | Purpose |
|---|---|
| `npx nx run <app>:test` | unit + widget tests (guarded: skips-with-reason without the SDK) |
| `npx nx run <app>:analyze` | static analysis |
| `npx nx run <app>:test-integration` | integration_test against a device/emulator |
| `flutter test test/home_view_test.dart` | single file |
| `flutter test --name 'refresh'` | by test name |

## Bet Slice Rollout — the permanent tests a slice owes

When a bet slice's progress tests go green, the slice rolls out permanent coverage before it closes (bet workflow, Delivery). The bet-progress tests prove the capability once and are archived; these stay. The Prove-Once Rule governs the whole rollout — surface tests prove wiring, rendering, and interaction; they never re-prove a business rule the capability core already owns.

- **Widget tests (always).** The bulk of the slice's coverage: pump each View the slice delivered inside a `ProviderScope` with fake repositories, assert through semantics and visible text, and cover its error and empty states — not just the happy path.
- **Unit tests (when logic earned them).** Pure-Dart tests for branching logic the slice introduced in a view model, mapper, or repository — through `ProviderContainer`, testing the real Notifier. Plumbing does not earn one; the widget test already covers it.
- **Golden tests (when the slice touched a design-system component).** A new or changed token-projected component extends the alchemist goldens; screen-level goldens do not — they churn on every copy change.
- **Integration / Patrol (only when the journey or the OS boundary is new).** A new critical journey earns one happy-path `integration_test`; a flow that newly leaves Flutter for the OS earns Patrol. Trace assertions do not apply — a Flutter client emits no OpenTelemetry traces, so there is no span surface to assert on.
