# Documentation

Dart ships its documentation discipline in the toolchain: `dart doc` renders `///` comments to API pages, the formatter normalises them, and the `public_member_api_docs` lint flags missing ones on a public surface. The language — sound null safety, immutable widgets, `const` — is built so that well-shaped code carries most of its own meaning. Lean on that before reaching for prose.

## Hierarchy

Structure documents more reliably than comments. A comment is a promise no analyzer checks; when the widget tree changes, the comment silently lies. Documentation priority — the foundations principle (`docs/principles/foundations/documentation.md`) written the Flutter way:

1. **Types and null safety** — the analyzer rejects incorrect types and unhandled nulls. Zero drift risk.
2. **Naming** — the official View/ViewModel/Repository conventions, which are load-bearing (`references/architecture.md`). Rename before you comment.
3. **`const` and immutability** — an immutable model and a `const` constructor declare intent the analyzer enforces (`references/widgets-and-composition.md`).
4. **Test names** — a widget test named for its behaviour is executable documentation verified by CI.
5. **Dartdoc `///` on public API** — rendered by `dart doc`; written only when types cannot carry the contract.
6. **Inline "why" comments** — last resort for a genuinely non-obvious decision.

Levels 1–4 are verified by tooling. Levels 5–6 are human promises that drift. Minimise them.

## Dartdoc on Public API

A dartdoc comment uses `///`, leads with a one-sentence summary, and references other API in square brackets so `dart doc` links them:

```dart
/// Holds stock for an [order] until the reservation TTL expires.
///
/// Throws [OutOfStockException] when the requested quantity is unavailable.
Future<Reservation> reserve(Order order, int quantity);
```

Document the **public** surface — the exported API a consumer in another library calls. A private widget (`_Header`) is read with the build method that uses it; a doc comment there usually restates the code below.

State what the signature cannot: the exceptions a caller must catch, the lifecycle of a returned `Stream`, the units of a parameter. Do not narrate the type.

```dart
// BAD — restates the signature
/// Returns the user with the given id.
Future<User> getUser(String id);

// GOOD — skip it; the name + types already say this
Future<User> getUser(String id);
```

## Names Are the Documentation

The cheapest documentation is the official name. The architecture conventions are not style preferences — `ProfileView`/`ProfileViewModel`, `OrderRepository`/`RemoteOrderRepository`, `AuthService` are how the next agent finds the right file on the first try (`references/architecture.md`). A `HomeController` or `UserStore` documents nothing because it matches no convention.

A small, single-purpose widget names its job in its class declaration:

```dart
// The name is the contract; no comment adds anything.
class OrderStatusBadge extends StatelessWidget {
  const OrderStatusBadge({super.key, required this.status});
  final OrderStatus status;
  // ...
}
```

## Structure as Documentation

A composed widget tree documents itself when it is built from small, named, `const` pieces. A `build` method that reads as a list of well-named child widgets needs no comment to explain its layout — the composition *is* the explanation (`references/widgets-and-composition.md`).

This is why `Widget _buildHeader()` helpers are a documentation failure as much as a performance one: a method named `_buildHeader` hides a subtree behind a verb, where an extracted `_Header` widget names the thing. Extract the widget; the name replaces the comment.

Immutability documents the data flow. A `freezed` sealed union spells out every state a value can hold, exhaustively matched at the call site — prose listing "the order can be draft, placed, or cancelled" is the type, written worse (`references/architecture.md`).

## Inline Comments

Inline comments explain **why**, never **what**. The widget already says what it renders; the comment captures the reason the next reader cannot recover from the tree.

```dart
// LayoutBuilder, not MediaQuery: this card also renders inside a side
// pane and a test harness, where screen size is the wrong signal.
return LayoutBuilder(builder: (context, constraints) { /* ... */ });
```

A comment narrating the obvious is noise — the reader can see the `Column`.

```dart
// BAD — narrates the tree
// a column with a title and a body
return Column(children: [Title(), Body()]);
```

## A Comment Is Often a Smell

When you reach for a comment to explain *what* a block does, the widget is asking to be refactored. The comment is debt; the fix is in the code:

- A comment heading a chunk of a long `build` → extract a named widget.
- A comment explaining a magic number → move it to the theme/density system as a named token (`references/theming-and-design-tokens.md`).
- A comment decoding a boolean argument → name the parameter or introduce an enum.
- A comment explaining why a field is mutable → it should be immutable; the comment is covering a broken data flow.

Delete the comment and fix the structure. The refactor cannot drift; the comment can.

## In-Code Markers

```dart
// TODO(bob): paginate once the repository exposes a cursor. Issue #231.
// FIXME(carol): rebuild storm when the parent re-themes. Issue #245.
// HACK(dave): clamp negative durations from the platform clock until SDK fix.
```

Always include `(username)` and an issue reference. A marker without one will never be resolved.

## What NOT to Document

- Self-evident widgets where the class name and props tell the whole story.
- Private widgets (`_Header`) read in context with their parent's build method.
- `@override Widget build(...)` — never document an override the framework defines.
- Provider declarations whose name states what they expose (`orderRepositoryProvider`).
- Generated code (`*.g.dart`, `*.freezed.dart`) — never hand-edit comments into it.
