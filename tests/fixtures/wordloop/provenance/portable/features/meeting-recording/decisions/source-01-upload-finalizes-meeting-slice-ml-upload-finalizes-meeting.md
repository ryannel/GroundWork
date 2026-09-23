# Frozen source: 01-upload-finalizes-meeting/slice-ml-upload-finalizes-meeting.mdx

---
title: "ML — Batch Transcription and Synthesis"
description: "Pub/Sub consumer, AssemblyAI batch pipeline, OpenAI synthesis, and Core write-back for the upload-finalizes-meeting milestone."
audience: engineers
owner: product-platform
status: active
source_of_truth: meeting-recording bet
---
# Slice 2: ML — Batch Transcription and Synthesis

> **Owner**: ML engineer
> **Domain**: ML
> **Complexity**: M
> **Prerequisite**: Slice 1 merged and `./dev gen all` run

Consumes the `transcription-jobs` Pub/Sub topic, runs AssemblyAI batch transcription on the standardized audio, then generates headline, summary, topics, talking points, and tasks via OpenAI, writing all results back to Core.

## Required Capabilities

- [ ] Pub/Sub consumer for `transcription-jobs` topic — de-duplicates by `(transcription_id, audio_version)` using the CloudEvents `id` as idempotency key
- [ ] On `transcription.requested.v1` receipt, call `PATCH /transcriptions/{id}/status` to transition to `transcribing`
- [ ] Download audio from GCS using the `storage_path` from the event
- [ ] Submit audio to AssemblyAI batch transcription API (with speaker diarisation enabled); poll until complete
- [ ] Write transcript segments to Core via `PUT /transcriptions/{id}/segments` with `is_final: true` for all segments
- [ ] Call `PATCH /transcriptions/{id}/status` to transition to `synthesizing` after transcript write-back succeeds
- [ ] Run OpenAI synthesis on the final transcript to extract: headline, summary, topics, talking points, and tasks. Enforces strict Pydantic/Zod schemas; safely returns empty arrays `[]` if no tasks/points are found.
- [ ] Write synthesis artefacts to Core:
  - `PUT /meetings/{id}/synthesis` — summary, topics, and talking points
  - `PUT /meetings/{id}/tasks/system` — extracted tasks with `source_segment_ids`
- [ ] Call `PATCH /transcriptions/{id}/status` to transition to `completed` after all write-backs succeed
- [ ] Transient failures (e.g., OpenAI timeout during synthesis) must push to a Dead Letter Queue (DLQ) for exponential backoff retry without restarting transcription.
- [ ] On permanent synthesis failure (after DLQ exhaustion), call `PATCH /transcriptions/{id}/status` to `completed` with `is_degraded: true` and a human-readable `message`
- [ ] On permanent transcription failure, call `PATCH /transcriptions/{id}/status` to `failed` and a human-readable `message`
- [ ] Expose `POST /transcription-jobs/{id}/run` REST endpoint for deterministic test control (service auth only); accepts the same payload shape as the Pub/Sub event
- [ ] Expose `GET /transcription-jobs/{id}` REST endpoint returning current job progress

## Dependencies

- Core Slice 1 merged; `./dev gen all` has been run so the generated Core client is up to date
- AssemblyAI API key available as `ASSEMBLYAI_API_KEY`
- OpenAI API key available as `OPENAI_API_KEY`
- GCS read access to `WORDLOOP_AUDIO_BUCKET` (service account credentials in local dev)
- Pub/Sub subscription `transcription-jobs-sub` provisioned against the `transcription-jobs` topic

## Pipeline Sequencing

Synthesis must not start until `PUT /transcriptions/{id}/segments` has returned `204`. The two stages are sequential — synthesis uses the final transcript as its input.

```
Pub/Sub event received
  → status: transcribing
  → GCS download
  → AssemblyAI batch → poll complete
  → PUT /transcriptions/{id}/segments
  → status: synthesizing
  → OpenAI synthesis
  → PUT /meetings/{id}/synthesis
  → PUT /meetings/{id}/tasks/system
  → status: completed
```

On transient failure (like provider timeout), allow the DLQ to retry. If transcription fails permanently, transition to `failed`. If synthesis fails permanently, transition to `completed` with `is_degraded: true`.

## Test Cases

Test cases map to `tests/bets/meeting-recording/test_slice_ml_upload_finalizes_meeting.py`. Run via `./dev test bet meeting-recording`.

| Test | Location | Assertion |
|---|---|---|
| Pub/Sub event triggers transcription | `test_ml` | Publishing a `transcription.requested.v1` event causes `PATCH /transcriptions/{id}/status` with `status: transcribing` |
| AssemblyAI segments written to Core | `test_ml` | `PUT /transcriptions/{id}/segments` called with at least one `is_final: true` segment |
| Synthesis write-backs all called | `test_ml` | `PUT /meetings/{id}/synthesis` and `PUT /meetings/{id}/tasks/system` all called after `status: synthesizing` |
| Status transitions correct order | `test_ml` | Observed sequence: `transcribing → synthesizing → completed` |
| Transcription Failure writes `status: failed` | `test_ml` | Simulated AssemblyAI error causes `PATCH /transcriptions/{id}/status` with `status: failed` |
| Synthesis Failure writes `completed` and `is_degraded` | `test_ml` | Simulated OpenAI permanent failure causes `PATCH /transcriptions/{id}/status` with `status: completed` and `is_degraded: true` |
| Partial write-back retry (**deferred** — see note below) | `test_system` | DLQ retry successfully completes synthesis write-backs without repeating transcription |
| `POST /transcription-jobs/{id}/run` is idempotent | `test_ml` | Calling twice with same idempotency key does not duplicate write-backs |
| Duplicate Pub/Sub message ignored | `test_ml` | Second delivery of same `(transcription_id, audio_version)` produces no additional write-backs |
| Empty Arrays Handled | `test_ml` | A meeting with zero tasks generates an empty array, not a failure or hallucination |

> **Deferred: Partial write-back retry (DLQ)**
> This test is a cross-cutting system test that requires both the ML and Core slices to be fully integrated. It validates that a DLQ-redelivered message completes synthesis without re-running transcription — which depends on the Core slice's status API contracts and the ML consumer's "skip transcription on retry" logic. Implement as a system-level test after Core Slice 1 lands and both sides of the contract are stable.

## Completion Checklist

- [ ] Code merged and deployed
- [ ] Bet progress tests pass (`./dev test bet meeting-recording`)
- [ ] Permanent service tests implemented per [testing strategy](/docs/principles/foundations/testing)
- [ ] Code review completed
- [ ] API review completed
- [ ] Testing review completed
- [ ] System documentation updated (architecture docs, API reference as applicable)
