# Frozen source: 11-recording-hardening/index.mdx

---
title: "11 Recording Hardening"
description: "Recording handles long sessions, browser limits, no-audio conditions, and diagnostics."
audience: engineers
owner: product-platform
status: active
source_of_truth: meeting-recording bet
---
# 11 Recording Hardening

## Goal

A live recording behaves predictably under real-world browser and session constraints, with clear guards, automatic stops, capability gates, and diagnostics.

## Why This Comes Now

The core user value is proven before hardening so edge-case policy can be tested against complete recording, finalization, notes, insights, tasks, speakers, and playback behaviour rather than a partial flow.

## Included Scope

- Validate long recording session behaviour against the agreed duration target.
- Handle background tab behaviour with visible user guidance and diagnostics.
- Detect no-audio input and warn or stop according to policy.
- Auto-stop recordings when hard limits are reached.
- Prevent conflicting multi-tab recording control for the same user and meeting.
- Gate unsupported Safari or OPFS capability combinations with clear fallback messaging.
- Capture diagnostics for recording health, recovery, and failure investigation.

## Not Included

- New user-visible meeting artifacts beyond the recording and review flow.
- Mobile-native recording support.
- Cross-device recording handoff.
- Enterprise compliance workflows or retention policy automation.

## Domain Slices

| # | Domain | Slice summary | Scaffold command | Complexity | Prerequisite |
|---|---|---|---|---|---|
| 1 | Core | `max_duration_seconds` enforcement; `RecordingDurationWarningEvent` and auto-stop; session lock preventing a second active recording per user; `recording_event_history` diagnostics table | `./dev new slice meeting-recording 11-recording-hardening core recording-limits` | M | Milestone 05 merged |
| 2 | ML | `no_audio_detected` health signal; unusable-audio detection emitted as `RecordingHealthEvent` domain signal | `./dev new slice meeting-recording 11-recording-hardening ml recording-health-signals` | S | Milestone 04 merged |
| 3 | App | `MediaRecorder` / OPFS capability gate before recording starts; multi-tab guard (disable Start if another tab has an active session via `has_active_recording` filter); no-audio warning banner; auto-stop countdown overlay | `./dev new slice meeting-recording 11-recording-hardening app recording-hardening-ui` | M | Slices 1 + 2 merged |

## Acceptance

These criteria map to `tests/bets/meeting-recording/test_milestone_11_recording_hardening.py`. Run via `./dev test bet meeting-recording`.

- [ ] Long sessions remain stable through the agreed recording duration target or stop with a clear limit state.
- [ ] Background tab behaviour is visible and does not silently corrupt recording state.
- [ ] No-audio input produces a warning or auto-stop according to policy.
- [ ] Recording auto-stops when hard duration or health limits are reached.
- [ ] A second tab cannot start or control a conflicting recording for the same meeting.
- [ ] Unsupported Safari or OPFS capability combinations are gated before recording starts.
- [ ] Diagnostics identify recording health, reconnects, degradation, and stop reasons.
