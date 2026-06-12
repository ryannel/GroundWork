import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../domain/models/health_status.dart';
import '../services/api_client.dart';

/// Repositories are the data layer's source of truth: they own caching,
/// retry, and the translation of contract payloads into domain models.
/// View models depend on this abstract class, so tests substitute an
/// in-memory fake without a mocking framework
/// (docs/principles/stack/flutter/architecture.md).
abstract class StatusRepository {
  Future<HealthStatus> status();
}

/// The remote implementation consumes the typed client. Nothing above this
/// layer knows the transport.
class RemoteStatusRepository implements StatusRepository {
  RemoteStatusRepository(this._client);

  final ApiClient _client;

  @override
  Future<HealthStatus> status() async {
    try {
      return await _client.health();
    } catch (_) {
      // An unreachable gateway is a state the UI renders, not an exception
      // the view model unwinds on.
      return const HealthStatus.unreachable();
    }
  }
}

final statusRepositoryProvider = Provider<StatusRepository>(
  (ref) => RemoteStatusRepository(ref.watch(apiClientProvider)),
);
