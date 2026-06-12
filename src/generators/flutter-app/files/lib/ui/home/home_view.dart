import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/theme/app_theme.dart';
import 'home_view_model.dart';

/// The home View: widgets only — layout, rendering, and command dispatch.
/// All state lives in HomeViewModel; all colours and shapes come from the
/// theme. Replace this screen as your first feature lands.
class HomeView extends ConsumerWidget {
  const HomeView({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(homeViewModelProvider);

    return Scaffold(
      appBar: AppBar(
        title: state.maybeWhen(
          data: (home) => Text(home.appName),
          orElse: () => const SizedBox.shrink(),
        ),
      ),
      body: Center(
        child: state.when(
          loading: () => const CircularProgressIndicator(),
          error: (error, _) => _StatusCard(
            label: 'Something went wrong',
            detail: '$error',
            ok: false,
          ),
          data: (home) => _StatusCard(
            label: home.gateway.reachable
                ? 'Wired to the workspace gateway'
                : 'Gateway unreachable',
            detail: home.gateway.status,
            ok: home.gateway.reachable,
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => ref.read(homeViewModelProvider.notifier).refresh(),
        tooltip: 'Refresh gateway status',
        child: const Icon(Icons.refresh),
      ),
    );
  }
}

class _StatusCard extends StatelessWidget {
  const _StatusCard({
    required this.label,
    required this.detail,
    required this.ok,
  });

  final String label;
  final String detail;
  final bool ok;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final status = theme.extension<StatusColors>()!;

    return Semantics(
      label: 'Gateway status: $detail',
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                ok ? Icons.check_circle_outline : Icons.cloud_off_outlined,
                size: 48,
                color: ok ? status.success : theme.colorScheme.error,
              ),
              const SizedBox(height: 16),
              Text(label, style: theme.textTheme.titleLarge),
              const SizedBox(height: 4),
              Text(detail, style: theme.textTheme.bodyMedium),
            ],
          ),
        ),
      ),
    );
  }
}
