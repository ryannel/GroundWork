import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/app_config.dart';
import '../../domain/models/health_status.dart';

/// The core-access seam: a thin, typed dio client bound to the workspace
/// gateway (docs/principles/stack/flutter/architecture.md).
///
/// Contract-client tooling stance (O8): this client is hand-rolled and stays
/// deliberately thin — one method per promoted-contract operation, typed
/// request/response models in domain/models. That is the lightest path while
/// the contract surface is small, and it adds no JVM codegen dependency to the
/// toolchain. When the promoted openapi.yaml grows past a handful of
/// operations, switch to generated clients via openapi_generator's dart-dio
/// output (build_runner) and keep this class as the seam the repositories
/// consume — nothing above the data layer changes.
class ApiClient {
  ApiClient(this._dio);

  final Dio _dio;

  /// Probe the gateway's health endpoint — the wiring proof the home feature
  /// renders. Replace and extend with the operations your promoted contract
  /// defines.
  ///
  /// `/health` is what GroundWork's Go and Python cores serve. If this
  /// surface fronts a Next.js BFF instead, its route is `/api/healthz` —
  /// adjust the path to your gateway, not the other way around.
  Future<HealthStatus> health() async {
    final response = await _dio.get<Map<String, dynamic>>('/health');
    return HealthStatus.fromJson(response.data ?? const <String, dynamic>{});
  }
}

/// The auth seam: an async token supplier the request interceptor consults on
/// every call. The default is unauthenticated — wire your identity provider
/// (e.g. the Clerk session JWT on a Clerk-protected core) by overriding this
/// provider; the core's `/health` route stays public either way.
final authTokenProvider = Provider<Future<String?> Function()>(
  (ref) => () async => null,
);

/// Builds the Authorization interceptor from a token supplier. Kept as a
/// top-level function so tests exercise it without booting a widget tree.
Interceptor authInterceptor(Future<String?> Function() token) {
  return InterceptorsWrapper(
    onRequest: (options, handler) async {
      final value = await token();
      if (value != null && value.isNotEmpty) {
        options.headers['Authorization'] = 'Bearer $value';
      }
      handler.next(options);
    },
  );
}

/// The client is a provider like every other shared dependency, so tests
/// override it (or the repositories above it) with fakes.
final apiClientProvider = Provider<ApiClient>((ref) {
  final dio = Dio(
    BaseOptions(
      baseUrl: AppConfig.apiBaseUrl,
      connectTimeout: const Duration(seconds: 5),
      receiveTimeout: const Duration(seconds: 10),
      headers: const {'Accept': 'application/json'},
    ),
  );
  dio.interceptors.add(authInterceptor(ref.read(authTokenProvider)));
  return ApiClient(dio);
});
