# Widgets and Composition

## Composition Over Inheritance

New UI composes existing widgets; it never subclasses a widget to alter behaviour. A `PrimaryButton` wraps and configures `FilledButton`; it does not extend it:

```dart
class PrimaryButton extends StatelessWidget {
  const PrimaryButton({super.key, required this.label, this.onPressed});

  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return FilledButton(
      onPressed: onPressed,
      child: Text(label),
    );
  }
}
```

Flutter's rendering model rewards exactly one style — small, pure, const-friendly widgets composed deeply. Every deviation is something the next change must special-case.

---

## Extract Widgets, Not Helper Methods

`Widget _buildHeader()` defeats const canonicalisation and rebuild isolation — the framework cannot skip a subtree it cannot identify. Extract a widget class instead:

```dart
// WRONG — helper method
Widget _buildHeader(BuildContext context) => Row(children: [...]);

// RIGHT — extracted widget, rebuild-isolated, const-capable
class _Header extends StatelessWidget {
  const _Header({required this.title});
  final String title;
  @override
  Widget build(BuildContext context) => Row(children: [...]);
}
```

Extract when a subtree is reused, when it can become `const`, or when a build method stops fitting on a screen.

---

## const Discipline

Every constructor that can be `const` is `const`; every instantiation site that can use `const` does. A `const` widget is canonicalised and skipped during rebuilds — the cheapest performance work in the framework. `flutter_lints` (`prefer_const_constructors` and friends) enforces this; treat those lints as errors, not suggestions.

Practical habit: when a `const` keyword fails to compile, ask why the widget isn't const-capable before deleting the keyword — often a value should be passed in rather than computed inline.

---

## Build Purity

`build` reads state and returns widgets. It never:

- mutates state (including provider state),
- fires network requests,
- shows dialogs or snackbars,
- starts animations or timers.

Flutter may call `build` at any frequency; an impure build turns rebuild cadence into behaviour. Side effects belong in view-model commands, lifecycle hooks (`initState`, `ref.listen`), or explicit handlers:

```dart
// Side-effect on state change: ref.listen, not build.
ref.listen(submitOrder, (prev, next) {
  if (next is MutationError) {
    ScaffoldMessenger.of(context).showSnackBar(/* ... */);
  }
});
```

A conditional in `build` that encodes a business rule belongs in the view model; `build` branches on view state only.

---

## Keys

Keys appear in exactly three situations:

1. **Reorderable/filterable lists** — `ValueKey(item.id)` on each child, so state follows identity, not position.
2. **Tree-shape changes around stateful widgets** — preserving state when conditionals restructure the tree.
3. **`GlobalKey` for the rare imperative handle** — forms (`FormState`), nothing else.

A key sprinkled "to be safe" is noise. A missing key on a reorderable list is a state-corruption bug. A `GlobalKey` reaching into another widget's state is a view model that wasn't written.

---

## Layout Decisions

- **`LayoutBuilder` over `MediaQuery.of(context).size`** — a widget responds to its parent's constraints, not the screen. MediaQuery-based layout breaks the moment the widget is placed in a pane, sheet, or test harness.
- Spacing and sizes come from the theme/density system, not magic numbers (see `references/theming-and-design-tokens.md`).
- Tap targets meet the 48dp minimum (see `references/accessibility.md`).

---

## Review Checklist

Flag in review:

- [ ] Any subclassed framework widget (composition exists).
- [ ] `Widget _buildX()` helper methods returning subtrees.
- [ ] Missing `const` where the lint reports it.
- [ ] Side effects (mutation, requests, dialogs, animation starts) inside `build`.
- [ ] Business-rule conditionals inside `build`.
- [ ] `Color(0xFF...)`, raw `TextStyle(...)`, or magic paddings (theme violation — see theming reference).
- [ ] Lists built from dynamic collections without `ValueKey`s.
- [ ] `MediaQuery.size` used for layout branching.
