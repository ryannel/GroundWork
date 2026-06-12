# Accessibility

## Table of Contents
- [The Baseline](#the-baseline)
- [Semantics](#semantics)
- [Tap Targets](#tap-targets)
- [Dynamic Type](#dynamic-type)
- [Contrast](#contrast)
- [Accessibility as the Test Seam](#accessibility-as-the-test-seam)
- [Review Checklist](#review-checklist)

---

## The Baseline

Accessibility is a merge gate, not a backlog item. The baseline for every feature: semantic labels on interactive widgets, 48dp tap targets, WCAG AA contrast (inherited from the token palette), and layouts that survive large text scales. An accessibility failure blocks the slice the way a failing test does.

## Semantics

Every interactive widget exposes a meaningful semantic label — through the widget's built-in semantics (`Text`, `Tooltip`, button labels) or an explicit `Semantics` wrapper when the visual content alone is ambiguous:

```dart
// Icon-only button: the tooltip doubles as the semantic label.
IconButton(
  icon: const Icon(Icons.refresh),
  tooltip: 'Refresh gateway status',
  onPressed: onRefresh,
)

// Composite tile whose meaning isn't the sum of its texts:
Semantics(
  label: 'Order ${order.id}, ${order.statusLabel}',
  button: true,
  child: OrderTile(order: order),
)
```

Guidelines:

- Labels describe **meaning, not appearance** ("Refresh gateway status", not "circular arrow icon").
- Don't over-wrap: redundant `Semantics` around already-labelled widgets produces double announcements. Use `MergeSemantics` to combine fragments that should read as one.
- Purely decorative visuals get `ExcludeSemantics`.
- Dynamic state (loading, error) is announced — render it as text or update the label, don't communicate it by colour alone.

## Tap Targets

Interactive targets meet the **48dp minimum** in both dimensions. Material widgets enforce this by default (`materialTapTargetSize`); the rule bites with custom `GestureDetector`/`InkWell` wrappers around small visuals:

```dart
// Small visual, full-size target:
InkWell(
  onTap: onTap,
  child: const SizedBox(
    width: 48,
    height: 48,
    child: Center(child: Icon(Icons.close, size: 20)),
  ),
)
```

## Dynamic Type

Layouts must not break at large text scales. Practical rules:

- Never set fixed heights on text-bearing containers; let text size drive layout.
- Test at scale: pump widget tests with `MediaQuery(textScaler: TextScaler.linear(2.0))` for layout-sensitive components, and exercise device large-text settings during manual passes.
- Truncation (`overflow: TextOverflow.ellipsis`) is for genuinely unbounded user content, not a fix for layouts that can't absorb scale.

## Contrast

Contrast meets WCAG AA **via the token palette** — it is enforced at the design-system layer and inherited here. The implementation duty: consume theme roles (see `references/theming-and-design-tokens.md`) so the audited pairs stay paired. Hand-mixed colours (opacity hacks, lightened variants) silently break audited contrast and are review findings on two counts.

## Accessibility as the Test Seam

Flutter's semantics tree is also the widget-test seam: tests find by `find.bySemanticsLabel` and visible text, so **inaccessible UI is untestable UI**. This makes the baseline self-enforcing — a widget you cannot address semantically in a test is a widget a screen reader cannot address either. When a test reaches for `find.byType` or a key because nothing semantic exists, treat it as the accessibility defect it is and label the widget.

```dart
testWidgets('refresh is reachable by semantics', (tester) async {
  await tester.pumpWidget(harness());
  expect(find.bySemanticsLabel('Refresh gateway status'), findsOneWidget);
});
```

## Review Checklist

- [ ] Every interactive widget has a meaningful semantic label.
- [ ] Icon-only buttons carry `tooltip` or `Semantics`.
- [ ] Custom gesture surfaces meet 48dp.
- [ ] No state communicated by colour alone.
- [ ] Layout verified (or tested) at 2.0 text scale.
- [ ] All colours via theme roles — no hand-mixed variants.
- [ ] Widget tests find by semantics, not widget types.
