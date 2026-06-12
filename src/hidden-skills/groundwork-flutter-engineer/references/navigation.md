# Navigation

## Table of Contents
- [The Router Is go_router](#the-router-is-go_router)
- [The Route Table](#the-route-table)
- [Typed Routes](#typed-routes)
- [Tab Scaffolds: StatefulShellRoute](#tab-scaffolds-statefulshellroute)
- [Auth Guards: Centralized redirect](#auth-guards-centralized-redirect)
- [The Route as State](#the-route-as-state)
- [Deep Links](#deep-links)
- [What Remains for Navigator 1.0](#what-remains-for-navigator-10)

---

## The Router Is go_router

go_router (flutter.dev verified publisher, declared feature-complete — a stable platform piece) owns app-level navigation. The router lives in one module as a provider:

```dart
final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    routes: [/* the route table */],
    redirect: (context, state) => _guard(ref, state),
  );
});
```

`MaterialApp.router(routerConfig: ref.watch(routerProvider))` is the only place the router meets the widget tree. Hand-rolled `RouterDelegate`/Navigator 2.0 code is legacy — it is the API go_router exists to hide. Do not write it, and refactor it away on contact.

## The Route Table

One table, hierarchical, every destination declared:

```dart
GoRoute(
  path: '/orders',
  name: 'orders',
  builder: (context, state) => const OrdersView(),
  routes: [
    GoRoute(
      path: ':orderId',
      name: 'order-detail',
      builder: (context, state) =>
          OrderDetailView(orderId: state.pathParameters['orderId']!),
    ),
  ],
)
```

Conventions:

- Paths are URL-shaped and lowercase-kebab; names exist for every route.
- The view receives parsed parameters via its constructor — it does not read `GoRouterState` internally.
- New screens are added to the table, never pushed ad hoc from a feature file.

## Typed Routes

As the table grows past a few routes, adopt `go_router_builder` typed routes — route paths and parameters as generated, compile-checked classes:

```dart
@TypedGoRoute<OrderDetailRoute>(path: '/orders/:orderId')
class OrderDetailRoute extends GoRouteData {
  const OrderDetailRoute({required this.orderId});
  final String orderId;

  @override
  Widget build(BuildContext context, GoRouterState state) =>
      OrderDetailView(orderId: orderId);
}

// Navigation becomes compile-checked:
const OrderDetailRoute(orderId: '42').go(context);
```

Stringly-typed `context.go('/orders/$id')` calls scattered through features are the navigation equivalent of hand-rolled JSON — acceptable only while the table is a handful of routes, refactored to typed routes as it grows.

## Tab Scaffolds: StatefulShellRoute

Bottom-bar/tab UIs use `StatefulShellRoute.indexedStack` — per-tab navigation stacks whose state survives tab switches:

```dart
StatefulShellRoute.indexedStack(
  builder: (context, state, shell) => AppScaffold(shell: shell),
  branches: [
    StatefulShellBranch(routes: [GoRoute(path: '/home', ...)]),
    StatefulShellBranch(routes: [GoRoute(path: '/settings', ...)]),
  ],
)
```

Do not hand-roll tab stacks with nested Navigators.

## Auth Guards: Centralized redirect

Auth is one `redirect` function on the router — never per-screen checks:

```dart
String? _guard(Ref ref, GoRouterState state) {
  final signedIn = ref.read(sessionProvider).isSignedIn;
  final signingIn = state.matchedLocation == '/sign-in';
  if (!signedIn && !signingIn) return '/sign-in?from=${state.matchedLocation}';
  if (signedIn && signingIn) return '/';
  return null;
}
```

Wire the session provider to the router with `refreshListenable` (or rebuild the router provider on session change) so guard decisions re-evaluate when auth state changes.

## The Route as State

The URL is a first-class state container. Selected entity id, active tab, current screen — if the route encodes it, **no provider duplicates it**; a provider mirroring the route will drift. This also makes navigation state survive process death for free, which matters because mobile processes die constantly.

## Deep Links

Anything declared as a `GoRoute` is deep-linkable across Android/iOS — that falls out of the declarative table. Practical consequences:

- Every route must render sensibly when entered **directly** (cold start onto `/orders/42`): the view model fetches what it needs from its id parameters; no route depends on in-memory state a previous screen happened to leave behind.
- Guard-sensitive routes are protected by the central `redirect`, so deep links cannot skip auth.

## What Remains for Navigator 1.0

Imperative `showDialog`, `showModalBottomSheet`, and one-off local flows are fine — they are transient UI, not app navigation. The boundary: if a destination should be linkable, restorable, or guarded, it is a `GoRoute`; if it is a momentary overlay, Navigator 1.0 primitives are correct.
