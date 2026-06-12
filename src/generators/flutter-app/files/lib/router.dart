import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'ui/home/home_view.dart';

/// The route table. go_router makes every declared route deep-linkable, and
/// the URL is a first-class state container — state the route already encodes
/// is never duplicated in a provider.
///
/// As the table grows: adopt go_router_builder for compile-checked typed
/// routes, StatefulShellRoute for tab scaffolds, and a centralized `redirect`
/// for auth guards. See docs/principles/stack/flutter/widgets-and-composition.md.
final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    routes: [
      GoRoute(
        path: '/',
        name: 'home',
        builder: (context, state) => const HomeView(),
      ),
    ],
  );
});
