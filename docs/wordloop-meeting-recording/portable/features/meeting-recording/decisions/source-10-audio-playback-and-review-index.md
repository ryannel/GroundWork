# Frozen source: 10-audio-playback-and-review/index.mdx

---
title: "10 Audio Playback And Review"
description: "Final review supports audio playback, signed access, and synced transcript navigation."
audience: engineers
owner: product-platform
status: active
source_of_truth: meeting-recording bet
---
# 10 Audio Playback And Review

## Goal

A user can review a finalized meeting with tabs, play the stored audio through a signed URL, see transcript highlighting synced to playback, and click transcript text to seek.

## Why This Comes Now

Playback relies on durable source audio, final transcript timestamps, and stable review artifacts. It follows speaker labelling so review can include the finalized transcript metadata users need to inspect.

## Included Scope

- Final review tabs for transcript, summary, talking points, tasks, notes, and playback-related review.
- Serve playable meeting audio through a time-limited signed URL.
- An audio player on the finalized meeting review screen.
- Highlight transcript content according to current playback time.
- Click transcript content to seek the audio player.

## Not Included

- Download/export of audio or transcript.
- Editing transcript text from the playback review UI.
- Advanced waveform visualization or variable playback analytics.
- Recording hardening policies such as auto-stop, no-audio detection, and multi-tab guard.

## Domain Slices

| # | Domain | Slice summary | Scaffold command | Complexity | Prerequisite |
|---|---|---|---|---|---|
| 1 | Core | `GET /meetings/{id}/audio-url` returning a time-limited GCS signed URL; `mime_type` and `duration_ms` in response | `./dev new slice meeting-recording 10-audio-playback-and-review core audio-url` | S | Milestone 05 merged (composed `audio.webm` exists) |
| 2 | ML | `start_ms` / `end_ms` timestamps on every final transcript segment from batch AssemblyAI output | `./dev new slice meeting-recording 10-audio-playback-and-review ml timestamped-transcript` | S | Milestone 04 merged |
| 3 | App | Audio player component wired to signed URL; active segment highlight synced to `currentTime`; click-to-seek on transcript rows | `./dev new slice meeting-recording 10-audio-playback-and-review app audio-playback-ui` | M | Slices 1 + 2 merged |

## Acceptance

These criteria map to `tests/bets/meeting-recording/test_milestone_10_audio_playback_and_review.py`. Run via `./dev test bet meeting-recording`.

- [ ] Finalized meeting review shows the expected review tabs.
- [ ] Audio playback loads through a signed URL rather than exposing raw storage access.
- [ ] User can play, pause, and seek the meeting audio.
- [ ] Transcript highlighting follows the current playback time.
- [ ] Clicking transcript content seeks the audio player to the matching time.
- [ ] Expired or unavailable signed URLs produce a visible recoverable playback error.
