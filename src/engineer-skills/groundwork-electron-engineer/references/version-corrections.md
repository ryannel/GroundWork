# Version Corrections

Where the model's training data is stale. This file is a checklist, not a tutorial — each item names what changed, why it bites, and the minimal fix. Verify against `package.json` before applying; the Electron major moves every 8 weeks and this file's claims age with it.

## The currency window — verify the numbers, then schedule the upgrade

Only the latest **three** Electron majors receive security patches, and a new major ships every **8 weeks** — Chromium CVEs land in the shipped app on Chromium's schedule, not the team's. An app more than three majors behind is running known-exploitable browser bugs. Treat the upgrade as scheduled work with dependency-CVE priority. Both numbers are upstream policy — confirm them against electronjs.org release docs when planning, not from memory.

When bumping, verify the Playwright driver pairing in CI — driver/Electron launch regressions have happened (e.g. the 36.x launch failure fixed in 37).

## Fuses are mandatory, not optional hardening

Training data often presents fuses as an advanced hardening menu. Post-CVE-2025-55305 (heap-snapshot tampering backdoored Signal/Slack/1Password past code-integrity checks), shipping without ASAR integrity validation is a defect. The full fuse table and rationale: `references/security.md` → Fuses.

## Windows signing: Azure Artifact Signing

Renamed from Azure Trusted Signing; GA since Jan 2026 — cloud-HSM-backed, clears SmartScreen, runs from CI via signtool/jsign. USB-token OV/EV certificates cannot live in a pipeline; they are the legacy path training data still recommends. Tooling note: post-rename CLI tools have needed `--prerelease` flags — verify current tool names when wiring CI.

## macOS notarization: `altool` is dead

Notarization goes through `notarytool`; any snippet built on `altool` is from a dead toolchain. Config shape: `references/packaging-and-updates.md` → Code Signing.
