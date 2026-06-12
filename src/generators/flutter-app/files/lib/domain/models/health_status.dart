/// The gateway's health, as the home feature renders it.
///
/// Domain models are immutable. This one is a plain const class because it is
/// trivial; once models carry real shape (unions, copyWith, JSON round-trips),
/// introduce freezed — it earns its place at that point, not before
/// (docs/principles/stack/flutter/architecture.md).
class HealthStatus {
  const HealthStatus({required this.reachable, this.status = ''});

  factory HealthStatus.fromJson(Map<String, dynamic> json) {
    return HealthStatus(
      reachable: true,
      status: json['status']?.toString() ?? 'ok',
    );
  }

  const HealthStatus.unreachable()
      : reachable = false,
        status = 'unreachable';

  final bool reachable;
  final String status;
}
