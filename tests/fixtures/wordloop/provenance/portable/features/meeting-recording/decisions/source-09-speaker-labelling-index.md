# Frozen source: 09-speaker-labelling/index.mdx

---
title: "09 Speaker Labelling"
description: "Speaker labels can be assigned to people and survive final transcript replacement."
audience: engineers
owner: product-platform
status: active
source_of_truth: meeting-recording bet
---
# 09 Speaker Labelling

## Goal

A user can assign transcript speaker labels to people, create missing people, and keep those assignments when the final transcript replaces provisional transcript output.

## Why This Comes Now

Speaker labels depend on transcript identity and final replacement semantics. They come after task reconciliation because both require user-owned metadata to survive regenerated ML output without being overwritten.

## Included Scope

- Show speaker labels on transcript turns or segments.
- Assign an existing person to a speaker label.
- Create a new person from the speaker assignment flow.
- Persist speaker-to-person assignments on the meeting.
- Preserve assignments when the final transcript replaces provisional live transcript output.

## Not Included

- Automatic speaker identity recognition across meetings.
- Speaker-aware task assignment or summary rewriting.
- Contact enrichment, avatars, or organization directory sync.
- Audio playback review and synced transcript highlighting.

## Domain Slices

| # | Domain | Slice summary | Scaffold command | Complexity | Prerequisite |
|---|---|---|---|---|---|
| 1 | Core | `POST /meetings/{id}/speaker-labels`; person lookup / create; `speaker_label → person_id` mapping persisted to `transcript_segments`; mapping survives `PUT /transcriptions/{id}/segments` replacement; `SpeakerStateUpdatedEvent` to ML during live session | `./dev new slice meeting-recording 09-speaker-labelling core speaker-assignment` | M | Milestone 04 merged |
| 2 | App | Speaker label display on transcript segments; inline assignment dropdown (existing person or create new); assignment optimistically applied; unassigned labels visually distinct | `./dev new slice meeting-recording 09-speaker-labelling app speaker-labelling-ui` | M | Slice 1 merged |
| 3 | ML | `speaker_label` field populated on `TranscriptSegmentProducedEvent` from AssemblyAI diarization; `SegmentFeaturesProducedEvent` for voice embeddings | `./dev new slice meeting-recording 09-speaker-labelling ml speaker-diarization` | S | Milestone 04 merged |

## Acceptance

These criteria map to `tests/bets/meeting-recording/test_milestone_09_speaker_labelling.py`. Run via `./dev test bet meeting-recording`.

- [ ] Transcript output displays distinct speaker labels.
- [ ] User can assign an existing person to a speaker label.
- [ ] User can create a person from the speaker labelling flow.
- [ ] Speaker assignments persist after refresh.
- [ ] Stopping and finalizing the recording replaces provisional transcript output without dropping assigned people.
- [ ] Unassigned speaker labels remain clearly visible for later review.
