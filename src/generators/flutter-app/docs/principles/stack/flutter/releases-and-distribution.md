---
title: Releases and Distribution
description: Store signing discipline, CI/CD with GitHub Actions + fastlane or Codemagic, pubspec versioning, the forced-upgrade floor, and Shorebird code push.
status: active
last_reviewed: 2026-06-12
---
# Releases and Distribution

## TL;DR

Both stores are shipped from CI: GitHub Actions + fastlane by default, Codemagic as the Flutter-native alternative. Signing material never touches git. Versions are `x.y.z+build` in pubspec with the build number CI-incremented. A backend-driven minimum-version floor with the `upgrader` package is mandatory — it is the mechanism that makes contract compatibility enforceable on a fleet that lags releases by months. Shorebird code push is the Dart-only OTA lane.

## Why this matters

A mobile surface cannot be rolled back and cannot be force-refreshed: every version ever shipped is potentially still running, store review adds days of latency, and a signing mistake can lock you out of your own listing permanently. Release engineering is therefore not a deploy script — it is the half of the architecture's compatibility story that lives outside the repo. The agent-closable loop axis also bites here: a release process with a human clicking through Xcode is a process the delivery loop stalls on, so everything below is CI-driven.

## Signing

**Android.** One upload keystore per app, generated once, stored in a secret manager with an independent secure copy — the official docs warn it is unrecoverable, and losing it means losing the update path. `key.properties` and the keystore are never in git; CI injects them from encrypted secrets (or Codemagic code-signing identities). **Play App Signing** holds the actual app signing key, so a compromised upload key is rotatable.

**iOS.** **App Store Connect API keys** drive CI authentication — no human Apple ID sessions in automation. Certificates and provisioning profiles are managed fastlane-match-style (encrypted, centrally stored, CI-fetched); Codemagic automates the same with managed code signing.

A keystore or service-account JSON committed to a repo is an incident, not a finding.

## CI/CD

Two converging stacks; both are sound, pick one per product and record it:

- **GitHub Actions + fastlane** (default — it shares the runner platform every other GroundWork surface uses): `supply` publishes to Play, `deliver`/`pilot` to App Store Connect/TestFlight.
- **Codemagic** — Flutter-native CI with built-in store publishing and managed signing; fastlane is preinstalled, so the stacks compose rather than compete.

The 2026-standard flow: PRs run the test gate (see [Testing](testing.md) — widget tests plus the headless-emulator integration lane); merges to main build signed release artifacts; artifacts publish to the **internal track / TestFlight first**, then promote to production after staged rollout. No artifact reaches a store that CI did not build, sign, and test.

## Versioning

pubspec carries `version: x.y.z+buildNumber`. Humans own `x.y.z` (it is the user-visible and compatibility-relevant part); **CI owns the build number**, auto-incrementing per release build via `--build-number` (`--build-name` overrides the version when needed). Hand-bumped build numbers collide; collided build numbers are store-upload rejections.

## Forced upgrade — the contract-compatibility floor

The architecture's stance is that a published contract field is never broken — because the fleet consuming it lags releases by months and cannot be recalled. Forced upgrade is the other half of that bargain: the floor below which the core stops accommodating old clients.

- The core (or a config endpoint / Firebase Remote Config) publishes a **minimum supported version**; the app compares at startup.
- The **`upgrader`** package implements the prompt: `minAppVersion` below the floor auto-hides "Later"/"Ignore".
- Two tiers, used deliberately: **soft prompt** (dismissible — new features, gentle migration pressure) and **hard force** (blocking — security issues, a contract the core can no longer serve).

The floor advances slowly and is a recorded product decision each time, because a hard force on a user mid-task is the worst interaction the product will ever ship. Between "never break a field" and "hard floor," every fleet version in the window is served correctly; outside it, the app says so honestly. Shipping a contract-breaking core change without first raising the floor and waiting out adoption is a sequencing defect.

## Shorebird code push

**Shorebird** is the OTA lane: stable on Android and iOS, store-policy compliant, Dart-only patches with `shorebird_code_push` for in-app patch checks. Use it for what it is — a hotfix channel that skips store latency for Dart-level defects — not as a release process. Native-code changes (plugins, Pigeon modules, SDK bumps) still require a store release, so OTA never substitutes for the version floor; a patched 1.4.2 is still 1.4.2 to the contract.

## Anti-patterns we reject

- **Signing material in the repo.** Keystores, `key.properties`, ASC keys, service-account JSON — secrets infrastructure only.
- **Manual store uploads.** A human with Xcode or the Play console in the loop is an unrepeatable release.
- **Breaking a published contract field because "the new app is out."** The fleet lags by months; the floor, not the release date, defines what you may drop.
- **Hard-forcing upgrades as a convenience.** Hard force is for security and served-contract limits; everything else is a soft prompt.
- **Treating Shorebird as the release process.** OTA patches Dart defects; features, native changes, and version floors move through the stores.
- **CodePush-era expectations.** Flutter never had Microsoft CodePush; Shorebird is the ecosystem answer, with Dart-only limits respected.
