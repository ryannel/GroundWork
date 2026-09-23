# Frozen source: 04-live-transcript-to-final-rebuild/slice-ml-streaming-transcription.mdx

---
title: "Streaming Transcription"
description: "ML AssemblyAI streaming orchestration, audio proxying, and drain protocol."
audience: engineers
owner: product-platform
status: active
source_of_truth: meeting-recording bet
---
# Streaming Transcription

> **Owner**: ML Engineer
> **Domain**: ml
> **Complexity**: L
> **Prerequisite**: Milestone 03 completed.

This slice implements the ML service's responsibility to manage the AssemblyAI real-time transcription session lifecycle. The ML service accepts session start/stop commands from Core over a REST API, receives binary audio chunks via HTTP, proxies them to AssemblyAI, pushes partial transcripts back to Core via a REST callback, and handles the explicit drain command required before final synthesis can begin.

## Required Capabilities

### Session Lifecycle
- [x] Implement `POST /streaming/start?meeting_id={id}` to open and authenticate an AssemblyAI WebSocket session. Returns a `session_id` used for all subsequent audio and stop calls.
- [x] Implement `DELETE /streaming/{session_id}` to flush the AssemblyAI buffer, wait for final transcripts, and cleanly disconnect. This is the drain protocol invoked synchronously by Core during `StopRecordingCommand` processing.
- [x] Raise `404` on `DELETE` if no active session exists for the given `session_id`.

### Audio & Event Routing
- [x] Implement `POST /streaming/{session_id}/audio` to receive binary audio chunks from Core and forward them to the AssemblyAI WebSocket stream.
- [x] Receive AssemblyAI transcript events and transform them into `TranscriptSegmentProducedEvent`.
- [x] Push completed `TranscriptSegment` events back to Core via the `CoreSegmentCallback` REST call.

### Backpressure & Resilience
- [ ] Monitor AssemblyAI buffer depths and emit `BackpressureEvent` if the provider lags. *(Deferred — not part of this slice's acceptance gate.)*
- [x] Log and surface AssemblyAI errors via the `on_error` callback provided at session start.
- [x] Operate in local/test mode without a live AssemblyAI connection (configurable gateway).

## Dependencies

- Core Live Recording Session — Core is the caller for all ML streaming REST endpoints.

## Domain Notes

**API Surface:**

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/streaming/start?meeting_id={id}` | Open AssemblyAI session. Returns `{ session_id }`. |
| `POST` | `/streaming/{session_id}/audio` | Accept a binary audio chunk (multipart `audio` field). |
| `DELETE` | `/streaming/{session_id}` | Drain buffer and close session. Called synchronously by Core. |

**Pipeline Sequencing:**
1. **Pre-warm**: Core hits `POST /streaming/start`. ML creates an internal `_StreamingSession` and opens AssemblyAI WS.
2. **Streaming**: Core sends binary chunks via `POST /streaming/{id}/audio`. ML forwards to AssemblyAI.
3. **Transcription**: AssemblyAI returns transcript events. ML fires `_on_segment` callback → `CoreSegmentCallback.push_segment`.
4. **Drain**: Core hits `DELETE /streaming/{id}`. ML sends EOF to AssemblyAI, waits for final transcript flush, removes session from the internal `_sessions` map, and returns `200 OK`.

**Timeout Contract:**
- Core enforces a **5-second timeout** on `DELETE /streaming/{session_id}`. The ML service must complete its drain and respond within that window or Core will log the failure and proceed with finalization.

## Test Cases

| Test | Location | Assertion |
|---|---|---|
| `test_ml_accepts_live_session_creation` | `test_slice_ml_streaming_transcription.py` | Assert `POST /streaming/start` returns 200 with a valid `session_id` in `data`. |
| `test_ml_forwards_audio_to_provider_and_emits_segments` | `test_slice_ml_streaming_transcription.py` | Assert `POST /streaming/{id}/audio` with dummy binary data returns 200 OK. |
| `test_ml_drain_command_flushes_final_segments` | `test_slice_ml_streaming_transcription.py` | Assert `DELETE /streaming/{id}` returns 200 OK and cleans up the session. |

> **Note:** The backpressure test (`test_ml_emits_backpressure_when_provider_lags`) was deferred — it requires a controllable mock provider with configurable latency and is not part of this slice's acceptance gate.

## Completion Checklist

- [x] Code merged and deployed
- [x] Bet progress tests pass (`./dev test bet meeting-recording`)
- [x] Permanent service tests implemented per testing strategy
- [x] Code review completed
- [x] API review completed (if new or modified API surfaces)
- [x] Testing review completed
- [x] System documentation updated
