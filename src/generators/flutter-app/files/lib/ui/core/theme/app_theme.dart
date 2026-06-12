import 'package:flutter/material.dart';

import 'brand_palette.dart';

/// Builds ThemeData from the generated BrandPalette projection.
///
/// Widgets consume Theme.of(context) and the [StatusColors] extension — never
/// BrandPalette directly, and never Color(0xFF...) literals. A hex literal in
/// a widget file is a review finding
/// (docs/principles/stack/flutter/widgets-and-composition.md).
ThemeData buildLightTheme() => _buildTheme(Brightness.light);

ThemeData buildDarkTheme() => _buildTheme(Brightness.dark);

ThemeData _buildTheme(Brightness brightness) {
  final bool dark = brightness == Brightness.dark;

  final ColorScheme scheme = ColorScheme.fromSeed(
    seedColor: dark ? BrandPalette.primaryDark : BrandPalette.primaryLight,
    brightness: brightness,
  ).copyWith(
    primary: dark ? BrandPalette.primaryDark : BrandPalette.primaryLight,
    secondary: dark ? BrandPalette.accentDark : BrandPalette.accentLight,
    surface: dark ? BrandPalette.surfaceDark : BrandPalette.surfaceLight,
    surfaceContainerHighest:
        dark ? BrandPalette.surfaceAltDark : BrandPalette.surfaceAltLight,
    onSurface: dark ? BrandPalette.textBodyDark : BrandPalette.textBodyLight,
    error: dark ? BrandPalette.errorDark : BrandPalette.errorLight,
  );

  final BorderRadius radius = BorderRadius.circular(BrandPalette.radiusBase);

  final ThemeData base = ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: scheme.surface,
  );

  return base.copyWith(
    textTheme: base.textTheme
        .apply(fontFamily: BrandPalette.bodyFontFamily)
        .copyWith(
          headlineLarge: base.textTheme.headlineLarge?.copyWith(
            fontFamily: BrandPalette.displayFontFamily,
            fontWeight: FontWeight.values[
                (BrandPalette.displayFontWeight ~/ 100 - 1).clamp(0, 8)],
          ),
          headlineMedium: base.textTheme.headlineMedium?.copyWith(
            fontFamily: BrandPalette.displayFontFamily,
            fontWeight: FontWeight.values[
                (BrandPalette.displayFontWeight ~/ 100 - 1).clamp(0, 8)],
          ),
          titleLarge: base.textTheme.titleLarge?.copyWith(
            fontFamily: BrandPalette.displayFontFamily,
          ),
        ),
    cardTheme: base.cardTheme.copyWith(
      shape: RoundedRectangleBorder(borderRadius: radius),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        shape: RoundedRectangleBorder(borderRadius: radius),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      border: OutlineInputBorder(borderRadius: radius),
    ),
    extensions: <ThemeExtension<dynamic>>[
      StatusColors(
        success: dark ? BrandPalette.successDark : BrandPalette.successLight,
        warning: dark ? BrandPalette.warningDark : BrandPalette.warningLight,
        info: dark ? BrandPalette.infoDark : BrandPalette.infoLight,
      ),
    ],
  );
}

/// Semantic status colours the Material ColorScheme has no roles for.
/// Read via `Theme.of(context).extension<StatusColors>()!`.
@immutable
class StatusColors extends ThemeExtension<StatusColors> {
  const StatusColors({
    required this.success,
    required this.warning,
    required this.info,
  });

  final Color success;
  final Color warning;
  final Color info;

  @override
  StatusColors copyWith({Color? success, Color? warning, Color? info}) {
    return StatusColors(
      success: success ?? this.success,
      warning: warning ?? this.warning,
      info: info ?? this.info,
    );
  }

  @override
  StatusColors lerp(StatusColors? other, double t) {
    if (other == null) return this;
    return StatusColors(
      success: Color.lerp(success, other.success, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
      info: Color.lerp(info, other.info, t)!,
    );
  }
}
