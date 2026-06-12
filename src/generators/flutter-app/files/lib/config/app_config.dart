/// Build-time configuration. Values arrive via --dart-define so no
/// environment file ships inside the binary.
abstract final class AppConfig {
  /// Base URL of the workspace gateway this surface is wired to.
  ///
  /// Override per environment:
  ///   flutter run --dart-define=API_BASE_URL=http://10.0.2.2:4000
  ///
  /// Note: the Android emulator reaches the host machine's localhost at
  /// 10.0.2.2; the iOS simulator uses localhost directly.
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:4000',
  );
}
