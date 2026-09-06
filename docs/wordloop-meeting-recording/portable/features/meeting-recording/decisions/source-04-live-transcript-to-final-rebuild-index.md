# Frozen source: 04-live-transcript-to-final-rebuild/index.mdx

---
title: "04 Live Transcript To Final Rebuild"
description: "Live recording streams transcript updates and stop reuses the upload finalization path."
audience: engineers
owner: product-platform
status: active
source_of_truth: meeting-recording bet
---
# 04 Live Transcript To Final Rebuild

## Goal

A user records live audio, sees a live transcript during the meeting, and stops recording to rebuild the same final artifacts through the finalization path proven by Milestone 01.

## Why This Comes Now

Live recording should not create a separate finalization model. After upload proves the rebuild path, live recording can focus on capture and streaming while stop hands the recorded audio into the same final transcript and synthesis pipeline.

## Included Scope

- Start and stop a live recording session from the meeting UI.
- Stream live audio from the browser to the backend processing path.
- Stream live transcript segments back to the user while recording continues.
- Persist the recorded audio source for final rebuild after stop.
- On stop, invoke the same finalization path proven in Milestone 01.
- Replace draft live transcript output with the final transcript and final meeting artifacts.

## Not Included

- Offline-first OPFS durability, reconnect gap recovery, or degraded health surfaces beyond basic live failure states.
- Private notes, live talking points, live tasks, speaker labelling, playback review, or hardening policies.
- Divergent live-only final synthesis behaviour.
- Pause/resume or multi-device recording control.

## Domain Slices

| # | Domain | Slice summary | Scaffold command | Complexity | Prerequisite |
|---|---|---|---|---|---|
| 1 | Core | WebSocket recording commands, ML session orchestration, GCS audio segment storage, finalization handoff to the M01 pipeline | `./dev new slice meeting-recording 04-live-transcript-to-final-rebuild core live-recording-session` | L | Milestone 01 merged |
| 2 | ML | AssemblyAI streaming session, live `TranscriptSegmentProducedEvent` output, drain on stop, final batch rebuild via M01 pipeline | `./dev new slice meeting-recording 04-live-transcript-to-final-rebuild ml streaming-transcription` | M | Slice 1 merged + `./dev gen all` |
| 3 | App | "Start Recording" entry point (from New Meeting dropdown), live transcript panel, stop button, stop-to-finalization transition state | `./dev new slice meeting-recording 04-live-transcript-to-final-rebuild app live-recording-ui` | M | Slice 1 merged + `./dev gen all` |

## Acceptance

These criteria map to `tests/bets/meeting-recording/test_milestone_04_live_transcript_to_final_rebuild.py`. Run via `./dev test bet meeting-recording`.

- [x] User starts a live recording session and sees recording state in the app.
- [x] Live transcript text appears while audio is being captured.
- [x] User stops recording and the meeting enters finalization.
- [x] Stop reuses the same finalization path proven by uploaded audio in Milestone 01.
- [x] Draft live transcript output is replaced by the final transcript when rebuild completes.
- [x] Final headline, summary, topics, talking points, and tasks match the final rebuild output.
- [x] A failed live stream or final rebuild leaves a visible recoverable state.
