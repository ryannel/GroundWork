# Releases and Distribution

## Table of Contents
- [Why This Is Architecture](#why-this-is-architecture)
- [Signing](#signing)
- [CI/CD Pipeline](#cicd-pipeline)
- [Versioning](#versioning)
- [Forced Upgrade: the Compatibility Floor](#forced-upgrade-the-compatibility-floor)
- [Shorebird Code Push](#shorebird-code-push)
- [Release Checklist](#release-checklist)

---

## Why This Is Architecture

A mobile surface cannot be rolled back and cannot be force-refreshed: every version ever shipped is potentially still running, store review adds days of latency, and a signing mistake can permanently lock the listing. Treat release engineering as the half of the contract-compatibility story that lives outside the repo — and keep it CI-driven, because a human clicking through Xcode is a step the delivery loop stalls on.

## Signing

**Android**

- One upload keystore per app, generated once, stored in a secret manager **with an independent secure copy** — the official docs warn it is unrecoverable.
- `key.properties` and the keystore are never in git; CI injects them from encrypted secrets (or Codemagic code-signing identities).
- **Play App Signing** holds the actual app signing key, so a compromised upload key is rotatable.

**iOS**

- **App Store Connect API keys** authenticate CI — no human Apple ID sessions in automation.
- Certificates/provisioning profiles are fastlane-match-style: encrypted, centrally stored, CI-fetched. Codemagic's managed signing is the equivalent.

A keystore or service-account JSON committed to a repo is an **incident**, not a finding: rotate it, scrub history, then fix the pipeline. The generated `.gitignore` already excludes signing material — keep it that way.

## CI/CD Pipeline

Default stack: **GitHub Actions + fastlane** (`supply` → Play, `deliver`/`pilot` → App Store Connect/TestFlight). **Codemagic** is the recorded Flutter-native alternative; fastlane is preinstalled there, so the stacks compose. Pick one per product and record it.

The standard flow:

```
PR        → analyze + widget tests + emulator integration lane (the test gate)
main      → build signed release artifacts (CI-owned build number)
artifact  → internal track / TestFlight first
promote   → staged rollout to production
```

No artifact reaches a store that CI did not build, sign, and test. Manual store uploads are unrepeatable releases — refuse them.

## Versioning

pubspec carries `version: x.y.z+buildNumber`:

- **Humans own `x.y.z`** — the user-visible, compatibility-relevant part.
- **CI owns the build number**, auto-incrementing per release build via `--build-number` (and `--build-name` when overriding the version). Hand-bumped build numbers collide, and collided build numbers are store-upload rejections.

## Forced Upgrade: the Compatibility Floor

The core's stance is that a published contract field is never broken — because the fleet lags releases by months and cannot be recalled. Forced upgrade is the other half of that bargain:

- The core (or a config endpoint / Firebase Remote Config) publishes a **minimum supported version**; the app compares at startup.
- The **`upgrader`** package implements the prompt: `minAppVersion` below the floor auto-hides "Later"/"Ignore".
- Two tiers, used deliberately:
  - **Soft prompt** (dismissible) — new features, gentle migration pressure.
  - **Hard force** (blocking) — security issues, or a contract the core can no longer serve.

Operational rules: the floor advances slowly and each advance is a recorded product decision; between "never break a field" and the floor, every fleet version is served correctly. **Shipping a contract-breaking core change without first raising the floor and waiting out adoption is a sequencing defect** — flag it whenever a slice proposes it.

## Shorebird Code Push

Shorebird (stable on Android and iOS, store-policy compliant) is the OTA lane for **Dart-only hotfixes** — it skips store latency for Dart-level defects, with `shorebird_code_push` for in-app patch checks. Boundaries:

- Native-code changes (plugins, Pigeon modules, SDK bumps) still require a store release.
- A patched 1.4.2 is still 1.4.2 to the contract — OTA never substitutes for the version floor.
- It is a hotfix channel, not the release process; features and floors move through the stores.

## Release Checklist

Before a release slice closes:

- [ ] CI builds, signs, and tests the artifact; no manual store steps.
- [ ] Build number CI-assigned; `x.y.z` deliberately chosen.
- [ ] No signing material, `key.properties`, ASC keys, or service-account JSON in the diff.
- [ ] Contract changes verified against the version floor (raise the floor first, then ship the change after adoption).
- [ ] Internal track / TestFlight before production; staged rollout configured.
- [ ] If Shorebird patched anything since the last release, the patch content is folded into this store release.
