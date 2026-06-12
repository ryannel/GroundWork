# Platform Channels

## Table of Contents
- [The Decision Ladder](#the-decision-ladder)
- [Check the Plugin Shelf First](#check-the-plugin-shelf-first)
- [Pigeon: the Default for Structured APIs](#pigeon-the-default-for-structured-apis)
- [Wrapping the Native Module](#wrapping-the-native-module)
- [ffigen/jnigen: the Tracked Destination](#ffigenjnigen-the-tracked-destination)
- [Raw MethodChannel](#raw-methodchannel)
- [iOS Build Wiring](#ios-build-wiring)
- [Testing the Boundary](#testing-the-boundary)

---

## The Decision Ladder

When a capability is not reachable from Dart:

1. **pub.dev** — a maintained, verified-publisher plugin is a dependency decision, not an interop project.
2. **Pigeon module** — write Swift/Kotlin behind a generated, typed boundary.
3. **Raw MethodChannel** — a single fire-and-forget call with no evolving surface, nothing more.

Dropping to native is a **capability decision, never a performance reflex**. Profile in Dart first — rendering and isolates cover almost every performance complaint, and a native detour taken for imagined speed buys two codebases for one feature. Legitimate native triggers: a platform API with no maintained plugin (HealthKit details, background modes, vendor SDKs), OS-integrated UI Flutter cannot render (widgets/complications, App Intents), hardware access below the plugin ecosystem.

## Check the Plugin Shelf First

Before writing native code: search pub.dev, check publisher verification, maintenance cadence, and issue tracker health. Rewriting a maintained verified-publisher plugin is negative work. Write native code when the shelf is empty or unmaintained.

## Pigeon: the Default for Structured APIs

Define the API once in Dart; Pigeon generates type-safe stubs on both sides — misspelled methods and mistyped arguments become compile errors instead of runtime channel exceptions:

```dart
// pigeons/battery_api.dart
import 'package:pigeon/pigeon.dart';

@ConfigurePigeon(PigeonOptions(
  dartOut: 'lib/data/services/gen/battery_api.g.dart',
  kotlinOut: 'android/app/src/main/kotlin/.../BatteryApi.kt',
  swiftOut: 'ios/Runner/BatteryApi.swift',
))
@HostApi()
abstract class BatteryApi {
  int batteryLevel();
  bool isCharging();
}
```

Run `dart run pigeon --input pigeons/battery_api.dart` and implement the generated interface in Kotlin/Swift. **Every structured Flutter↔native API goes through Pigeon** — keep the native side a small module the agent can regenerate.

## Wrapping the Native Module

The Dart side of a Pigeon API is a **service in the data layer**, like any other platform API:

```dart
class BatteryService {
  BatteryService(this._api);
  final BatteryApi _api;

  Future<BatteryReading> read() async => BatteryReading(
        level: await _api.batteryLevel(),
        charging: await _api.isCharging(),
      );
}

final batteryServiceProvider = Provider<BatteryService>(
  (ref) => BatteryService(BatteryApi()),
);
```

Repositories/view models consume the service; nothing above the data layer knows a channel exists. **Native code never grows business rules** — it is transport to an OS capability; rules live in the core or the view model where they are proven.

## ffigen/jnigen: the Tracked Destination

The ecosystem is mid-migration to channel-free codegen interop: `ffigen` (C/Obj-C/Swift; stable) and `jnigen` (Java/Kotlin via JNI; pre-1.0), on build hooks / native assets (default-enabled since Flutter 3.38). The stance:

- **Adopt where a dependency already ships it** — that is the dependency's choice.
- **Pigeon remains the app-code default** until the jnigen path reaches 1.0.
- Aim refactors at the destination; re-evaluate at the next ecosystem survey.

## Raw MethodChannel

Acceptable for exactly one shape: a single trivial call with no evolving surface (toggle a platform flag, read one value). The moment a channel grows a second method or a structured payload, it becomes a Pigeon definition. Hand-written channels for any real API surface are legacy — stringly-typed, runtime-failing, agent-hostile.

## iOS Build Wiring

**Swift Package Manager is the iOS/macOS default as of Flutter 3.44.** New native modules and plugin dependencies use SwiftPM; CocoaPods is the legacy path kept only where a required dependency has not migrated. Do not add new Podfile-based wiring.

## Testing the Boundary

- **Unit/widget tiers:** fake the Pigeon-fronted **service** in Dart like any other service — the native side does not run.
- **Emulator tier:** the native implementation is exercised by `integration_test` (or Patrol, when the flow crosses into OS UI) only where the capability is observable.
- Pure pass-through wrappers over OS APIs get a thin smoke test, not a re-proof of the OS.
