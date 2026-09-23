# Frozen source: 01-upload-finalizes-meeting/slice-core-upload-finalizes-meeting.mdx

---
title: "Core — Schema, Endpoints, Events"
description: "Database schema, REST API, WebSocket events, and Pub/Sub publishing for the upload-finalizes-meeting milestone."
audience: engineers
owner: product-platform
status: active
source_of_truth: meeting-recording bet
---
# Slice 1: Core — Schema, Endpoints, Events

> **Owner**: Core engineer
> **Domain**: Core
> **Complexity**: L

Establishes the entire data model and API surface that ML and App depend on. Nothing else in this milestone can be built until this slice is merged and `./dev gen all` has been run.

## Required Capabilities

- [ ] Write and apply DB migrations for all new tables: `meetings`, `audio_objects`, `transcriptions`, `transcription_status_history`, `transcript_segments`, `synthesis`, `topics`, `topic_segments`, `talking_points`, `talking_point_segments`, `tasks`
- [ ] `POST /meetings` — create a meeting with `source_type`, `title`, `start_time`; responds `201` with `Location`
- [ ] `GET /meetings` — paginated compact list; supports `source_type` filter
- [ ] `GET /meetings/{id}` — detail with `?expand=transcription,synthesis,tasks,attendees`
- [ ] `PATCH /meetings/{id}` — user notes update (service auth)
- [ ] `DELETE /meetings/{id}` — responds `204`; broadcasts `EntityChangedEvent`
- [ ] `POST /meetings/{id}/upload` — multipart file upload; strict magic-number sniffing (MP3, WAV, M4A, MP4, WebM, OGG, FLAC); enforces 1GB / 4hr limits; responds `409 Conflict` if `audio_objects` already exists; queues audio for standardization; responds `202`
- [ ] Audio Standardization Worker — background FFmpeg transcode of uploaded file to 16kHz mono Opus/WebM; stores standardized file to GCS; creates `audio_objects` and `transcriptions` (`status: pending`) records; publishes `com.wordloop.transcription.requested.v1` via transactional outbox
- [ ] `GET /meetings/{id}/transcriptions` — list (0 or 1)
- [ ] `GET /transcriptions/{id}` — status, progress, and `is_degraded`
- [ ] `GET /transcriptions/{id}/segments` — paginated; supports `after_ms`, `before_ms`, `is_final` filters
- [ ] `PATCH /transcriptions/{id}/status` — ML write-back; strictly validates against `pending, transcribing, synthesizing, completed, failed`; inserts `transcription_status_history` row; broadcasts `EntityChangedEvent { entity: "transcription" }`
- [ ] `PUT /transcriptions/{id}/segments` — ML batch replacement; atomic swap of all segments; broadcasts `TranscriptRevisedEvent`
- [ ] `GET /meetings/{id}/synthesis` — returns summary, headline, key_points, topics, and talking points
- [ ] `PUT /meetings/{id}/synthesis` — ML write-back; atomic replacement into `synthesis`, `topics`, `topic_segments`, `talking_points`, and `talking_point_segments`; broadcasts `SynthesisUpdatedEvent` and `EntityChangedEvent { entity: "meeting" }`
- [ ] `GET /meetings/{id}/talking-points` — returns talking points
- [ ] `GET /meetings/{id}/topics`
- [ ] `GET /meetings/{id}/tasks` — paginated task list scoped to meeting
- [ ] `GET /tasks` — cross-meeting task list; supports `meeting_id`, `status`, `assigned_to` filters
- [ ] `POST /tasks` — user or service-auth task creation; broadcasts `EntityChangedEvent { entity: "task", action: "created" }`
- [ ] `GET /tasks/{id}` — single task with `sub_task_summary`
- [ ] `PATCH /tasks/{id}` — promotes `source: system` task to `source: user` on any edit; broadcasts `EntityChangedEvent`
- [ ] `DELETE /tasks/{id}` — cascades to sub-tasks; broadcasts `EntityChangedEvent`
- [ ] `GET /tasks/{id}/sub-tasks`
- [ ] `POST /tasks/{id}/sub-tasks`
- [ ] `PUT /meetings/{id}/tasks/system` — ML batch reconciliation; preserves user-created and user-edited (`source: user`) tasks; removes unedited system tasks absent from the replacement set; responds `204`; broadcasts `EntityChangedEvent`
- [ ] Regenerate API spec: `./dev gen all`

## Dependencies

- GCS bucket and service account credentials configured in local dev (`WORDLOOP_AUDIO_BUCKET`)
- Pub/Sub topic `transcription-jobs` provisioned in the local emulator
- Transactional outbox relay running (part of `./dev start`)
- FFmpeg installed in the Core worker environment

## Schema Notes

All timestamps are `timestamptz NOT NULL DEFAULT now()`. Primary keys use `uuidv7()` (RFC 9562) — a pure PL/pgSQL function in `schema.sql` that produces time-ordered UUIDs for improved B-tree index locality. No external extensions required.

| Table | Key columns |
|---|---|
| `meetings` | `id`, `user_id`, `title`, `source_type`, `start_time`, `end_time`, `notes`, `created_at`, `updated_at` |
| `audio_objects` | `meeting_id` (PK, FK → meetings, 1:1), `storage_path`, `mime_type`, `size_bytes`, `duration_ms`, `checksum_sha256`, `audio_version`, `created_at` |
| `transcriptions` | `id`, `meeting_id`, `status` (pending, transcribing, synthesizing, completed, failed), `status_message`, `is_degraded`, `audio_version`, `created_at`, `updated_at` |
| `transcription_status_history` | `id`, `transcription_id`, `status` (CHECK: canonical 5), `status_message`, `created_at` |
| `transcript_segments` | `id`, `transcription_id`, `source_sequence`, `revision`, `speaker_label`, `person_id`, `text`, `start_ms`, `end_ms`, `confidence`, `is_final` |
| `synthesis` | `id`, `meeting_id`, `headline`, `summary`, `key_points`, `created_at`, `updated_at` |
| `topics` | `id`, `meeting_id`, `title`, `summary`, `is_final`, `created_at` |
| `topic_segments` | `topic_id`, `segment_id` |
| `talking_points` | `id`, `meeting_id`, `topic_id`, `content`, `is_final`, `created_at` |
| `talking_point_segments` | `talking_point_id`, `segment_id` |
| `tasks` | `id`, `meeting_id`, `content`, `status`, `source`, `assigned_to`, `due_date`, `parent_task_id`, `created_at`, `updated_at` |

`meetings.user_id` requires an index for list queries.

> **`audio_objects` 1:1 design**: Each meeting has at most one audio object. Using `meeting_id` as the sole PK enforces this at the database level and eliminates a redundant surrogate key. The FK to `meetings` provides cascade delete.

## Test Cases

Test cases map to `tests/bets/meeting-recording/test_slice_core_upload_finalizes_meeting.py`. Run via `./dev test bet meeting-recording`.

| Test | Location | Assertion |
|---|---|---|
| Migrations apply cleanly | `test_core` | `./dev db dry-run` exits 0; all expected tables present |
| `POST /meetings` returns 201 | `test_core` | Response includes `id`, `source_type`, `Location` header |
| `POST /meetings/{id}/upload` stores to GCS | `test_core` | Audio standardisation worker produces 16kHz Opus file; GCS object exists at expected key; `audio_objects` record persisted |
| `POST /meetings/{id}/upload` magic-number rejection | `test_core` | Uploading a fake file with `audio/webm` content-type returns 415 |
| `POST /meetings/{id}/upload` duplicate rejection | `test_core` | Returns 409 Conflict if `audio_objects` already exists |
| `POST /meetings/{id}/upload` limits enforced | `test_core` | Files exceeding 1GB or 4hrs return 413 Payload Too Large |
| Audio Standardization publishes Pub/Sub event | `test_core` | Outbox delivers `transcription.requested.v1` |
| `PATCH /transcriptions/{id}/status` inserts history row | `test_core` | `transcription_status_history` row contains correct status and message |
| `PUT /transcriptions/{id}/segments` replaces atomically | `test_core` | Final segment count matches input; prior segments absent |
| `PUT /meetings/{id}/tasks/system` preserves user tasks | `test_core` | User-created and user-edited tasks survive; unedited system tasks absent from input are removed |
| `EntityChangedEvent` broadcast on mutation | `test_core` | WebSocket subscriber receives event with correct `entity` and `action` fields |
| `TranscriptRevisedEvent` broadcast on segment batch replacement | `test_core` | Subscriber receives `transcript.revised.v1` |
| `SynthesisUpdatedEvent` broadcast on synthesis write-back | `test_core` | Subscriber receives `meeting.synthesis.updated.v1` |
| Unauthenticated requests rejected | `test_core` | `401` returned for every new endpoint without a valid bearer token |
| Service-auth write-back accepted | `test_core` | `PATCH /transcriptions/{id}/status` with service token returns `204` |
| Idempotency key deduplication | `test_core` | Retried `POST /meetings` with same `Idempotency-Key` returns the original `201` result |

## Completion Checklist

- [ ] Code merged and deployed
- [ ] Bet progress tests pass (`./dev test bet meeting-recording`)
- [ ] Permanent service tests implemented per [testing strategy](/docs/principles/foundations/testing)
- [ ] Code review completed
- [ ] API review completed
- [ ] Testing review completed
- [ ] System documentation updated (database reference, API reference, architecture docs as applicable)
