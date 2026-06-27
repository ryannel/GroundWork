# Native UI Check Contract

This is the contract a platform's UI check must satisfy to verify a `graphical-ui` surface. It exists because a graphical surface that ships with no UI check is unverified — and a check that cannot run must **block the milestone, not silently skip it**. When the `system-test-runner` generator meets a graphical surface whose test medium it has no runner for, it emits a fail-closed placeholder (`tests/system/test_<surface>_ui_check_missing.py`) that fails with the named gap. Implementing a real check to this contract is what turns that red green.

GroundWork ships **conforming** checks for three mediums today: `playwright` (web, via the runner's own `tests/system/` suite) and `flutter-integration` / `playwright-electron` (the Flutter `integration_test` and Electron `_electron` smoke harnesses the app scaffolds ship — each driven by the `system-test-runner` and each carrying the contract's dimensions on the real binary: render, the named async states, and design-system token match; navigation is exempt while those scaffolds are single-screen). A graphical surface on any other platform — a native iOS/SwiftUI app, an Android-native app, a desktop-native shell — needs a check built to the contract below, registered under a new test medium the generator recognises; until then the surface gets the fail-closed placeholder.

## What a native UI check must cover

A conforming check drives the **running, shipping build** of the surface — the artifact a user actually launches, not a test target that runs code the shipping build omits — and verifies, across the surface's key screens:

1. **Render.** Each key screen renders without a blank frame, an unstyled fallback, an error-boundary/crash overlay, or an uncaught exception. The screen a user reaches shows what it is supposed to show.
2. **Navigation — no dead ends.** Every screen the surface reaches has a way back or onward; no flow strands the user with no exit. The check drives the real navigation between the surface's screens and confirms each is reachable and leavable. A single-screen surface is exempt (there is nowhere to strand the user) — the same guard the web render-smoke applies when there is only one route; a surface that adds a second screen owes the navigation assertion.
3. **The named states.** For every asynchronous view, the check exercises its full set of states — empty, loading, in-progress, error — and confirms each renders as designed rather than as a frozen or broken screen. A view that only renders when data arrives is incomplete.
4. **Design-system match.** The surface renders in the project's design system — the specified tokens (colour, type, spacing, elevation, motion) resolve and land, rather than degrading to a flat platform default.

## How it integrates

- Register the new test medium so `system-test-runner`'s `KNOWN_MEDIA` set recognises it, and wire the runner fixture to drive the platform's harness (the pattern `flutter-integration` and `playwright-electron` already follow: the surface ships its harness, the fixture drives it through the app's build/test command as a subprocess).
- The check is part of the permanent system suite (`tests/system/`), run on every milestone close and at validation — the same fail-closed gate the web `render_smoke` / `a11y_smoke` / `token_conformance` checks run under.
- Until a platform's check exists, the placeholder stands in and fails. That is the correct state: the milestone cannot be declared proven on a surface nothing checks.
