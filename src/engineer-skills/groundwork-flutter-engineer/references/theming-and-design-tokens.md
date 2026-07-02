# Theming and Design Tokens

## The Projection Model

The theme is **generated from the design system's brand tokens**, not authored in the app. The chain:

```
docs/design-system.md  →  .groundwork/config/brand-tokens.json (visual block)
                       →  lib/ui/core/theme/brand_palette.dart   (GENERATED)
                       →  lib/ui/core/theme/app_theme.dart       (builds ThemeData)
                       →  Theme.of(context) in widgets
```

The same tokens drive every surface of the product (web, CLI, mobile), so cross-surface visual consistency is a build artifact, not a review hope. The consequence for implementation work: **a hex literal in a widget file is a review finding** — it forks the design system silently.

## The Generated Palette Module

`brand_palette.dart` carries the projected token values and is regenerated, never hand-edited:

- Palette roles in both themes: `primaryLight/primaryDark`, `accent…`, `surface…`, `surfaceAlt…`, `textBody…`, `success…`, `error…`, `warning…`, `info…`.
- Typography families and weights: `displayFontFamily`, `bodyFontFamily`.
- Shape: `radiusBase`.

Widgets do **not** import `brand_palette.dart`. Only `app_theme.dart` reads it, building `ThemeData` (ColorScheme, TextTheme, component themes, ThemeExtensions) from the constants. The palette is the projection artifact; the theme is the API.

## Consuming the Theme

```dart
@override
Widget build(BuildContext context) {
  final theme = Theme.of(context);
  return Container(
    decoration: BoxDecoration(
      color: theme.colorScheme.surfaceContainerHighest,
      borderRadius: BorderRadius.circular(BrandPalette.radiusBase), // only via shared components
    ),
    child: Text('Title', style: theme.textTheme.titleLarge),
  );
}
```

Resolution order when you need a colour or style:

1. A `ColorScheme` role (`primary`, `surface`, `error`, `onSurface`, ...).
2. A `ThemeExtension` (semantic roles the scheme lacks — see below).
3. A shared component (e.g. a `Card` whose shape the component theme already sets).
4. If none fits, the design system is missing a decision — raise it; do not inline a value.

Never: `Color(0xFF...)`, `TextStyle(fontSize: 13)`, `EdgeInsets.all(13)` with non-scale values, opacity-hacked variants of brand colours.

## Theme Extensions for Semantic Roles

Material's `ColorScheme` has no success/warning/info roles. The theme defines them as a `ThemeExtension` built from the palette:

```dart
final status = Theme.of(context).extension<StatusColors>()!;
Icon(Icons.check_circle, color: status.success);
```

When a new semantic role is needed (e.g. a "highlight" colour), extend the `ThemeExtension` in `app_theme.dart` from a palette/token value — do not scatter one-off colours.

## Dark Mode

Both themes are built from the same palette (each role carries light and dark values — a design-system commitment, not an option):

```dart
MaterialApp.router(
  theme: buildLightTheme(),
  darkTheme: buildDarkTheme(),
  themeMode: ThemeMode.system,
)
```

Implementation rules:

- Never branch on `Theme.of(context).brightness` to pick hardcoded colours — the scheme and extensions already resolved per-theme values.
- Every visual change is verified in both themes (widget tests pump both when the component is theme-sensitive — see `references/testing.md`).

## Typography

`app_theme.dart` applies the projected families to the `TextTheme` (display family on headlines/titles, body family elsewhere). Widgets use `textTheme` slots — `headlineMedium`, `titleLarge`, `bodyMedium` — never raw `TextStyle`s with families or sizes.

The families only render once their font assets are bundled in `pubspec.yaml` (`fonts:` section). Until then Flutter falls back silently — if the type looks wrong, check the asset bundling before the theme code.

## Evolving the Brand

When the design system changes:

1. The design-system run updates `brand-tokens.json`.
2. Regenerate (or mechanically update) `brand_palette.dart` to match — the file header marks it as generated.
3. `app_theme.dart` and all widgets pick the change up for free.

If a visual change cannot be expressed through tokens → palette → theme, that is a design-system gap to raise, not a license to hand-edit the palette.

## Material/Cupertino Freeze Note

Material and Cupertino are frozen in the core framework and moving to standalone packages — the version line and what to do when the packages land in this app's pubspec: `references/version-corrections.md`.
