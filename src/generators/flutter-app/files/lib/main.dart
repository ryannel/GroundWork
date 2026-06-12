import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';

void main() {
  // ProviderScope is the root of the provider graph — state management and
  // dependency injection in one mechanism. Everything shared is a provider;
  // see docs/principles/stack/flutter/state-management.md.
  runApp(const ProviderScope(child: App()));
}
