# Data and Contracts

## Table of Contents
- [The Seam](#the-seam)
- [The Thin Client (Current Stance)](#the-thin-client-current-stance)
- [When to Switch to Generated Clients](#when-to-switch-to-generated-clients)
- [Repositories: Translation and Truth](#repositories-translation-and-truth)
- [Error Mapping](#error-mapping)
- [Configuration](#configuration)
- [dio Conventions](#dio-conventions)
- [Anti-patterns](#anti-patterns)

---

## The Seam

The app reaches the capability core through exactly one seam:

```
ViewModel → Repository (abstract) → ApiClient (data/services/) → gateway
```

Nothing above the data layer knows the transport. A view model cannot tell whether the core is hosted or embedded, REST or gRPC. If transport details (URLs, status codes, `DioException`) appear above `data/`, the seam has leaked — fix the leak before the feature.

## The Thin Client (Current Stance)

The recorded contract-tooling stance (O8, settled 2026-06-12): while the promoted contract surface is small, the client is **hand-rolled and thin** — one method per contract operation, typed models in `domain/models/`, no codegen dependency:

```dart
class ApiClient {
  ApiClient(this._dio);
  final Dio _dio;

  Future<Order> order(String id) async {
    final res = await _dio.get<Map<String, dynamic>>('/api/v1/orders/$id');
    return Order.fromJson(res.data ?? const {});
  }

  Future<Order> placeOrder(PlaceOrderRequest req) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/api/v1/orders',
      data: req.toJson(),
    );
    return Order.fromJson(res.data ?? const {});
  }
}
```

Discipline that keeps "thin" honest:

- Every method maps 1:1 to a promoted-contract operation — the method set is the contract's operation list, nothing speculative.
- Request/response models live in `domain/models/` with explicit `fromJson`/`toJson` that match the contract schema field-for-field.
- When the contract changes, the client changes in the same slice — the promoted `openapi.yaml` is the source of truth, and drift between it and this client is a defect.

## When to Switch to Generated Clients

The thin client is the lightest path **while the surface is small**. Once the promoted `openapi.yaml` grows past a handful of operations (or starts carrying complex schemas you are hand-mapping), switch to generation: `openapi_generator`'s **dart-dio** output via build_runner, consuming the promoted spec directly.

The migration is contained by construction: repositories keep consuming a client; only the client's implementation becomes generated. Nothing above the data layer changes. Hand-mapping a large promoted contract is the defect the principles warn about — the contract is promoted precisely so clients can be generated from it.

## Repositories: Translation and Truth

Repositories own the boundary between contract types and domain models:

```dart
class RemoteOrderRepository implements OrderRepository {
  RemoteOrderRepository(this._client);
  final ApiClient _client;

  List<Order>? _cache;

  @override
  Future<List<Order>> recent({bool refresh = false}) async {
    if (!refresh && _cache != null) return _cache!;
    _cache = await _client.recentOrders();
    return _cache!;
  }
}
```

- Caching, retry policy, polling, and merge logic live here — not in view models, not in the client.
- Contract DTO → domain model translation happens here and nowhere else.
- Repositories are many-to-many with view models and never aware of each other.

## Error Mapping

The data layer converts transport failures into domain-meaningful states; `DioException` never crosses upward:

```dart
@override
Future<HealthStatus> status() async {
  try {
    return await _client.health();
  } on DioException catch (e) {
    if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.connectionError) {
      return const HealthStatus.unreachable();
    }
    rethrow; // programming errors still surface loudly
  }
}
```

Rules of thumb:

- **Expected failures** (offline, gateway down, 404 on an optional resource) become domain states the UI renders.
- **Contract violations** (schema mismatch, unexpected 500s) surface as errors — they indicate a defect, and the view renders the error state.
- Business rules about failures (retry budgets, "is this recoverable") still do not belong in views.

## Configuration

The gateway URL arrives at build time via `--dart-define`:

```dart
static const String apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://localhost:4000',
);
```

- Android emulator → host: `http://10.0.2.2:4000`. iOS simulator → `http://localhost:4000`.
- No `.env` files baked into the binary; no secrets in `--dart-define` either — a mobile binary is fully inspectable, so anything secret stays server-side.

## dio Conventions

- One `Dio` instance, configured in the client provider: `baseUrl`, timeouts, `Accept: application/json`.
- Cross-cutting concerns (auth header injection, logging, retry) are **interceptors** on that instance — not per-call options scattered through methods.
- dio throws on non-2xx by default; keep that behaviour and map in repositories rather than checking status codes inline.

## Anti-patterns

- **Transport above the data layer** — a view model importing `dio` or parsing status codes.
- **Hand-mapping a grown contract** — switch to dart-dio generation; the seam is built for it.
- **Speculative client methods** — operations the promoted contract does not define.
- **Business rules in the surface** — validation semantics, pricing, permissions re-implemented in Dart. The core proves them; the surface renders results.
- **Repositories calling repositories** — orchestration belongs in a view model or an earned use-case.
