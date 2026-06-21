---
name: groundwork-flutter-engineer
description: >
  Implement, review, and refactor Flutter mobile applications using the
  official two-layer MVVM architecture, Riverpod state management, go_router
  navigation, token-projected theming, widget and integration testing, Pigeon
  platform channels, and store release engineering. Use for work touching
  views, view models, repositories, services, providers, routing, theming,
  widget tests, integration tests, native interop, or mobile release
  pipelines. Make sure to use this skill whenever a user is working in a
  Flutter or Dart codebase, building mobile UI features, fixing mobile bugs,
  or reviewing Flutter code.
---

# Flutter Engineer

Mobile execution engineer for Flutter applications. This skill guides implementation within the official Flutter architecture — MVVM features over a repository data layer, a compile-safe Riverpod provider graph, token-projected theming, and a test pyramid whose expensive tiers stay thin because the surface proves wiring, not business logic.

## Operating Contract

1. Locate the architectural layer before editing. Views, view models, repositories, services, and domain models each have distinct responsibilities; a change that blurs them is wrong even when it works.
2. The capability core owns business logic. The surface is wired to it through a typed client in the data layer — never re-implement a rule the core's contract already proves.
3. Route durable mobile policy to the canonical docs (`docs/principles/stack/flutter/`) instead of duplicating it in code comments or this skill.
4. Verify lints, widget tests, theme consumption, and accessibility semantics before declaring work complete.

## Code intelligence (repo map + Serena)

GroundWork gives you a deterministic **repo map** (`npx groundwork-method repo-map` — tree-sitter import edges + PageRank centrality, cached to `.groundwork/cache/repo-map.json`) and the **Serena** MCP server (LSP-backed symbol navigation and editing), registered at init. Orient before reading widely: refresh the map, read its `centrality` ranking to find the hubs, then use Serena to navigate them (`get_symbols_overview` / `find_symbol` / `find_referencing_symbols`) and make reference-aware edits (`replace_symbol_body` / `rename`). Full workflow and the graceful-degradation contract live in `.groundwork/skills/code-intelligence.md`; fall back to ordinary reads and edits when they are unavailable.

## Core Pillars

1. **MVVM Over Two Layers** — Every feature is one View (widgets only) paired with one ViewModel (state + commands). Repositories are the data layer's source of truth; services wrap external interfaces. A Domain layer is added only when it earns its place. This is the official Flutter architecture, adopted wholesale — code written against it is code every Flutter engineer recognises.

2. **The Provider Graph Is the App** — Riverpod 3.x providers carry shared state and double as dependency injection. Construction order, disposal, and test substitution fall out of the graph. There is no service locator, no `provider`-package DI, and no GetX — ever.

3. **Theming Is a Projection** — `ThemeData` is built from a palette module generated from the design system's brand tokens. Widgets consume `Theme.of(context)` and theme extensions; a `Color(0xFF...)` literal in a widget file is a review finding.

4. **Tests Prove Wiring, Not Rules** — Widget tests are the bulk of coverage; `integration_test` happy paths run on a headless Android emulator; Patrol enters only at the Flutter/OS boundary. Business rules are proven once at the core's contract — surface tests never re-prove them.

5. **Native Is a Disciplined Hatch** — Dropping to Swift/Kotlin is a capability decision made through Pigeon's typed boundary, wrapped as a data-layer service. Never a performance reflex, never a raw `MethodChannel` for a real API surface.

## How to Use This Skill

Match the user's task to the smallest relevant reference set. Most tasks touch one or two references.

| Topic | Reference | Load When |
|-------|-----------|-----------|
| Architecture & Layers | `references/architecture.md` | Placing new code, understanding the MVVM/repository split, file organization, the core-access seam. |
| State Management | `references/state-management.md` | Providers, Notifiers, Mutations, ephemeral vs app state, provider testing seams. |
| Widgets & Composition | `references/widgets-and-composition.md` | Building or refactoring widgets, const discipline, build purity, keys, extraction. |
| Theming & Design Tokens | `references/theming-and-design-tokens.md` | Theme consumption, the generated palette, ThemeExtensions, dark mode, typography. |
| Navigation | `references/navigation.md` | go_router routes, shell routes, redirects, typed routes, deep links. |
| Data & Contracts | `references/data-and-contracts.md` | Repositories, services, the dio contract client, error mapping, contract-client tooling. |
| Testing | `references/testing.md` | Unit/widget/integration taxonomy, fakes, emulator CI, Patrol, goldens, test commands. |
| Platform Channels | `references/platform-channels.md` | Pigeon APIs, native modules, when to drop to Swift/Kotlin, SwiftPM wiring. |
| Releases & Distribution | `references/releases-and-distribution.md` | Signing, CI/CD pipelines, versioning, forced upgrade, Shorebird code push. |
| Accessibility | `references/accessibility.md` | Semantics, tap targets, dynamic type, contrast, a11y-driven testing. |

## Task Routing

- **New feature/screen** → Load `references/architecture.md`. One View + one ViewModel under `ui/<feature>/`; repository access only through the view model.
- **State or data-flow work** → Load `references/state-management.md`. Verify what is app state (provider) vs ephemeral (`setState`).
- **UI/visual work** → Load `references/widgets-and-composition.md` and `references/theming-and-design-tokens.md`. Check the generated palette before adding any colour.
- **API/contract work** → Load `references/data-and-contracts.md`. The client is the seam; repositories translate payloads to domain models.
- **Routing/deep-link work** → Load `references/navigation.md`. Check the existing route table conventions first.
- **Test work** → Load `references/testing.md`. Pick the cheapest tier that can carry the assertion.
- **Native capability work** → Load `references/platform-channels.md`. Check pub.dev for a maintained plugin before writing native code.
- **Release/store work** → Load `references/releases-and-distribution.md`. Signing material never enters the repo.

## Safety Gates

- Do not put business logic in widgets or `build` methods — it belongs in the view model, or more likely in the capability core.
- Do not introduce hardcoded colours, text styles, radii, or spacing. The theme module is generated from brand tokens.
- Do not add state-management or DI packages (`provider`, `get_it`, GetX, Bloc) without a recorded decision; Riverpod is the standing default.
- Do not re-implement a rule the core's contract proves, and do not hand-map a large promoted contract — generated clients exist for that.
- Do not build on experimental Riverpod APIs (offline persistence) in load-bearing paths.
- Run `flutter analyze` and `flutter test` where the SDK is available; report the tier as skipped (never silently green) where it is not.

## Hallucination Controls

Before presenting Flutter guidance as factual:

- Check `pubspec.yaml` for actual package versions and available dependencies.
- Check the existing `ui/`, `data/`, and `domain/` directories for naming conventions and patterns before proposing new ones.
- Check the generated theme module for colour and shape values before recommending visual changes.
- Check the route table in the router module before inventing paths or navigation flows.
- Label any recommendation based on general Flutter knowledge (rather than project-specific patterns) as an inference.

## Output Expectations

- Feature changes name the layer each file belongs to and why.
- UI changes reference the theme roles or extensions used, or justify an explicit deviation.
- New features include accessibility considerations (semantic labels, tap targets, dynamic type behaviour).
- Verification steps include the specific Nx targets or `flutter` commands to run, with the skipped-with-reason caveat when the SDK is absent.
- Recommendations distinguish project conventions from general Flutter practice.

## Antipatterns

Reject these patterns:

- **Logic in build methods** — Domain branching inside widgets instead of the view model. Build renders state.
- **setState as architecture** — App state held in `StatefulWidget`s and threaded through constructors. Ephemeral state only.
- **Hardcoded visual values** — Hex colours, raw `TextStyle`s, magic paddings that fork the design system silently.
- **Hand-written clients for large promoted contracts** — The contract is promoted precisely so clients can be generated from it.
- **Re-proving core logic on the surface** — Surface tests assert wiring and rendering; the contract suite already proved the rules.
- **Fat integration suites** — Emulator minutes are the most expensive test currency; widget tests carry the bulk.
- **Raw MethodChannels for real APIs** — Stringly-typed, runtime-failing. Pigeon exists.
- **Preemptive Domain layers** — Pass-through use-case classes add indirection and remove nothing.
