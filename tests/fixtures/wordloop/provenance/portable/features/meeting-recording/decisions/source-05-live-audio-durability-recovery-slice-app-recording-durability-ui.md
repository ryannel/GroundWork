# Frozen source: 05-live-audio-durability-recovery/slice-app-recording-durability-ui.mdx

---
title: "App — Recording Durability UI"
description: "OPFS shadow buffer worker, MediaRecorder → OPFS → WebSocket pipeline, worker-centric architecture with MessagePort proxy, bufferedAmount backpressure, gap upload on reconnect/stop, and RecordingHealthEvent banner states."
audience: engineers
owner: product-platform
status: active
source_of_truth: meeting-recording bet
---
# App — Recording Durability UI

> **Owner**: App Engineer
> **Domain**: app
> **Complexity**: L
> **Prerequisite**: Core Audio Durability slice (Slice 1) merged; `./dev gen all` run

When this slice is complete, the browser captures every audio chunk into an always-on OPFS shadow buffer via a dedicated Web Worker, sends audio to Core over the WebSocket with client-side backpressure handling, trims the OPFS buffer as Core confirms durable storage, uploads locally buffered gap chunks on reconnect or stop, and renders clear health-state banners for connectivity transitions. Audio capture never stops — even when the WebSocket is down — because the OPFS buffer operates independently of transport.

> **Terminology:** In this slice, *segment* has two meanings depending on context. GCS storage segments (aggregated audio frame objects) are referenced when discussing `AudioStoredProgressEvent` and `highest_contiguous_sequence`. Transcript segments (speaker-attributed text fragments) appear in live transcript rendering. The distinction is always clear from context.

## Architecture: Worker-Centric WebSocket Model

All audio pipeline logic runs in a dedicated OPFS Web Worker (`opfs-buffer.worker.ts`). The main thread owns the actual `WebSocket` object (required by the browser API — `WebSocket` cannot be constructed in a worker). The worker and main thread coordinate via `postMessage`:

```
┌─────────────────────────────────┐    ┌──────────────────────────────┐
│  Main Thread                    │    │  OPFS Worker                 │
│                                 │    │                              │
│  MediaRecorder                  │    │  Audio Pipeline Logic        │
│    └─ ondataavailable ──────────┼───►│    ├─ Assign sequence number │
│         (postMessage: chunk)    │    │    ├─ Write to OPFS          │
│                                 │    │    ├─ Enqueue for WS send    │
│  WebSocket (owned here)         │    │    └─ Manage send queue      │
│    ├─ onmessage ────────────────┼───►│                              │
│    │   (events from Core)       │    │  OPFS File System            │
│    ├─ send() ◄──────────────────┼────│    └─ chunks/*.bin           │
│    │   (worker provides data)   │    │                              │
│    └─ bufferedAmount ───────────┼───►│  Backpressure Logic          │
│         (polled by main thread, │    │    └─ pause/resume sends     │
│          result sent to worker) │    │                              │
└─────────────────────────────────┘    └──────────────────────────────┘
```

**Key design decisions:**
1. **Main thread owns `WebSocket`** — required by the browser API. Main thread calls `WebSocket.send()` with binary data provided by the worker.
2. **Worker owns the pipeline** — sequence assignment, OPFS writes, send queue management, and backpressure decisions all live in the worker.
3. **Main thread polls `bufferedAmount`** — at a regular interval (default: 100 ms), the main thread reads `WebSocket.bufferedAmount` and sends the value to the worker. The worker decides whether to pause or resume sends.
4. **`MediaRecorder` runs on a browser-internal thread** — not throttled in background tabs. `ondataavailable` fires on the main thread and immediately forwards raw audio to the worker.

## Required Capabilities

### OPFS Shadow Buffer Worker

- [ ] A dedicated Web Worker (`opfs-buffer.worker.ts`) manages all OPFS I/O using `createSyncAccessHandle()` from the Origin Private File System API.
- [ ] Every audio chunk produced by `MediaRecorder` is written to OPFS with a CRC32C integrity envelope: `uint32_be crc32c | uint32_be audio_length | raw_audio_bytes`.
- [ ] Each chunk carries a monotonically incrementing sequence number assigned in the worker. Sequence numbering starts at 1 and never resets during a session.
- [ ] The worker indexes chunks by sequence number so individual ranges can be read back during gap recovery without scanning the entire buffer.
- [ ] The worker runs unconditionally — it captures audio regardless of WebSocket or Core connectivity status.
- [ ] The main thread communicates with the worker via `postMessage` — never by sharing the `SyncAccessHandle`.

### MediaRecorder → OPFS → WebSocket Pipeline

- [ ] `MediaRecorder` produces chunks at a configurable interval (default: 100 ms via `timeslice` parameter).
- [ ] Each chunk is sent to the OPFS worker via `postMessage`. The worker writes to OPFS (always) and enqueues the chunk for WebSocket send (when connected and not paused by backpressure).
- [ ] The worker sends a `send_audio` message to the main thread when a chunk is ready for WebSocket transmission. The main thread calls `WebSocket.send()` with the binary frame.
- [ ] The WebSocket binary frame format matches the Audio contract: `uint32_be metadata_length | utf8_json metadata | raw_audio_bytes`, with metadata including `type`, `id`, `traceparent`, `meeting_id`, `sequence`, `started_at_ms`, `duration_ms`, `mime_type`, `crc32c`.
- [ ] Audio capture and OPFS writes continue during WebSocket disconnection. Chunks produced while disconnected are buffered in the worker's send queue and drained in sequence order on reconnect.

### Client-Side Backpressure

- [ ] The main thread polls `WebSocket.bufferedAmount` at a regular interval (default: 100 ms) and sends the current value to the worker via `postMessage`.
- [ ] When the worker observes `bufferedAmount` exceeding the pause threshold (default: 5 MB), it pauses WebSocket sends but does **not** pause `MediaRecorder` or OPFS writes.
- [ ] When the worker observes `bufferedAmount` dropping below the resume threshold (default: 1 MB), it drains the queued chunks in sequence order by sending `send_audio` messages to the main thread.
- [ ] Backpressure state is communicated to the main thread for optional UI indication (but does not trigger a health banner — this is transport-level flow control, not a degradation event).

### OPFS Trimming on Storage Confirmation

- [ ] The app listens for `AudioStoredProgressEvent` from Core, which carries `highest_contiguous_sequence`.
- [ ] On receipt, the app instructs the OPFS worker to delete all chunks with sequence ≤ `highest_contiguous_sequence`.
- [ ] OPFS trimming is asynchronous — it does not block audio capture or WebSocket sends.
- [ ] On `GapUploadCompleteEvent`, the app trims OPFS up to the new `highest_contiguous_sequence` and only retains chunks still covered by `remaining_missing_ranges`.

### Gap Upload on Reconnect

- [ ] On WebSocket reconnect during an active recording, the app queries the OPFS worker for `lastSequence` via the `get_manifest` command and sends `ResumeRecordingCommand` with `last_client_sequence` set to the worker's reported `lastSequence`.
- [ ] On receipt of `RecordingResumedEvent` (which carries `highest_contiguous_sequence` and `missing_ranges[]`), the app reads the requested ranges from OPFS.
- [ ] The app verifies CRC32C on each OPFS chunk before upload — chunks that fail CRC32C verification are skipped and reported as `local_buffer_corrupt_chunk`.
- [ ] Gap chunks are uploaded in batches of up to 50 per `POST /meetings/{id}/recording/chunks` request, as `multipart/form-data` with per-part fields: `sequence`, `started_at_ms`, `duration_ms`, `mime_type`, `sha256`, `audio`.
- [ ] Each batch upload includes an `Idempotency-Key` header.
- [ ] The app uses `remaining_missing_ranges` from each response to drive the next batch until no ranges remain.

### Gap Upload on Stop

- [ ] When `RecordingStoppedEvent` arrives (carrying `missing_ranges[]` and `gap_upload_deadline_at`), the app runs the same gap upload flow as reconnect.
- [ ] A determinate progress indicator shows upload progress on the Meeting Summary page.
- [ ] If the browser closes mid-upload after stop, the upload resumes on next page load using the OPFS buffer and `GET /meetings/{id}/recording/missing-chunks`, until `gap_upload_deadline_at`.

### Recording Health Banners

- [ ] The app renders health-state banners based on `RecordingHealthEvent` and local connectivity state:

| State | Trigger | Banner Display |
|---|---|---|
| `healthy` | Recording active, WebSocket connected, no degradation | Green indicator: "● Recording HH:MM:SS" |
| `reconnecting` | WebSocket `onclose` fires during active recording | Amber banner: "Reconnecting — audio is still being captured locally." |
| `degraded (ml)` | `RecordingHealthEvent` with `code: ml_unavailable` | Amber banner: "Live insights paused. Audio is still recording." |
| `degraded (storage)` | `RecordingHealthEvent` with `code: storage_unavailable` | Amber banner: "Cloud storage is temporarily unavailable. Audio is being captured locally." |
| `degraded (local_buffer)` | `RecordingHealthEvent` with `code: local_buffer_unavailable` or `local_buffer_full` | Red banner: "Local audio backup is unavailable. Recording continues but cannot recover from interruptions." |
| `recovered` | `RecordingHealthEvent` with `status: recovered` | Banner clears; returns to green "● Recording" state. |
| `failed` | `RecordingErrorEvent` with `severity: error` | Red banner with error message and "Stop Recording" action. |
| `uploading_gaps` | Gap upload in progress after reconnect or stop | Progress banner: "Uploading recovered audio... (X of Y chunks)" |

- [ ] Health banners are driven by a state machine — `degraded → recovered` clears the banner; `degraded → degraded` with a different domain adds to the active warnings.
- [ ] Multiple simultaneous degradations are displayed as a combined banner (e.g., "Live insights paused. Cloud storage is temporarily unavailable.").

### Background Tab Continuity

- [ ] All audio chunk processing (sequence numbering, OPFS writes, send queue management) runs in the Web Worker, which is exempt from background tab throttling.
- [ ] `MediaRecorder` runs on a browser-internal thread and is not throttled in background tabs.
- [ ] When the tab is backgrounded, the page title changes to "● Recording…" so the user can find the tab.

## Dependencies

- **Core Audio Durability slice** must be merged — specifically: `AudioStoredProgressEvent`, `RecordingResumedEvent`, `GapUploadCompleteEvent`, `POST /meetings/{id}/recording/chunks`, `GET /meetings/{id}/recording/missing-chunks`.
- **Milestone 04 App slice** must be merged — specifically: the `live-recording-view.tsx` component, WebSocket connection management, and `MediaRecorder` setup.
- **Browser support**: OPFS `createSyncAccessHandle()` requires Chrome 102+, Edge 102+, Safari 15.2+. Firefox support is not available (sync access handles) — this is a known no-go documented in the pitch (desktop browsers only).

## Domain Notes

### UI States

| State | Trigger Condition | User Sees |
|---|---|---|
| `idle` | No recording session | "Start Recording" button available |
| `connecting` | Start clicked, WS opening | Spinner: "Connecting..." |
| `recording` | `RecordingStartedEvent` received | Green dot + timer, live transcript panel |
| `reconnecting` | WS `onclose` during active recording | Amber banner, timer continues, transcript frozen |
| `degraded` | `RecordingHealthEvent(degraded)` | Amber/red banner depending on domain, recording continues |
| `recovered` | `RecordingHealthEvent(recovered)` | Banner clears, returns to `recording` |
| `stopping` | "Stop" clicked | Loading overlay: "Stopping recording..." |
| `uploading_gaps` | `RecordingStoppedEvent` with `missing_ranges.length > 0` | Progress bar: "Uploading recovered audio..." |
| `finalizing` | Gap upload complete, audio composing | "Creating summary..." (M01 processing UI) |
| `failed` | `RecordingErrorEvent(error)` | Red banner with error and "Stop Recording" action |

### OPFS File Layout

```
/wordloop/
  └── recordings/
      └── {meeting_id}/
          ├── manifest.json       ← {last_sequence, chunk_count, created_at}
          └── chunks/
              ├── 00000001.bin    ← CRC32C envelope + raw audio
              ├── 00000002.bin
              └── ...
```

### Worker Message Protocol

```typescript
// Main thread → Worker
type WorkerCommand =
  | { type: 'init'; meetingId: string }
  | { type: 'write_chunk'; sequence: number; startedAtMs: number; durationMs: number; audio: ArrayBuffer; crc32c: string }
  | { type: 'read_range'; startSequence: number; endSequence: number }
  | { type: 'trim'; upToSequence: number }
  | { type: 'trim_except'; upToSequence: number; retainRanges: Array<{ start: number; end: number }> }
  | { type: 'get_manifest' }
  | { type: 'buffered_amount'; bytes: number }
  | { type: 'ws_connected'; connected: boolean }
  | { type: 'destroy' }

// Worker → Main thread
type WorkerResponse =
  | { type: 'chunk_written'; sequence: number }
  | { type: 'send_audio'; frame: ArrayBuffer }
  | { type: 'range_data'; chunks: Array<{ sequence: number; startedAtMs: number; durationMs: number; audio: ArrayBuffer; sha256: string }> }
  | { type: 'range_error'; startSequence: number; endSequence: number; corruptSequences: number[] }
  | { type: 'trimmed'; upToSequence: number; freedBytes: number }
  | { type: 'manifest'; lastSequence: number; chunkCount: number; totalBytes: number }
  | { type: 'backpressure_state'; paused: boolean }
  | { type: 'error'; code: string; message: string }
```

### Degradation Model (App's Role)

The App is the presentation layer for pipeline health. It does not make degradation decisions — it renders state transitions emitted by Core.

| Layer | App's Role |
|---|---|
| **Pipeline Health** (Layer 1) | Receives `RecordingHealthEvent` and renders amber/red banners. Detects local WebSocket disconnection and renders "Reconnecting" banner. |
| **Audio Completeness** (Layer 2) | Maintains the OPFS shadow buffer as the safety net. Uploads gap chunks on reconnect/stop. Trims OPFS on `AudioStoredProgressEvent` / `GapUploadCompleteEvent`. |
| **Transcript Coverage** (Layer 3) | N/A — the app reads `transcriptions.is_degraded` from Core when rendering the transcript view, but this is a Milestone 06+ concern. |

## Test Cases

### OPFS buffer and pipeline

| Test | Location | Assertion |
|---|---|---|
| `test_app_opfs_worker_buffers_all_audio_chunks` | `test_app` | Start recording, produce 20 mock audio chunks. Verify the OPFS worker's manifest reports `chunkCount: 20` and `lastSequence: 20`. |
| `test_app_opfs_buffer_continues_during_ws_disconnect` | `test_app` | Start recording, disconnect the WebSocket after 10 chunks, produce 10 more chunks while disconnected. Verify OPFS manifest reports `chunkCount: 20` — all chunks buffered regardless of WS state. |
| `test_app_opfs_trims_on_audio_stored_progress` | `test_app` | Start recording, produce 30 chunks. Emit `AudioStoredProgressEvent` with `highest_contiguous_sequence: 20`. Verify the OPFS worker's manifest reports chunks only for sequences > 20. |
| `test_app_trims_opfs_on_gap_upload_complete` | `test_app` | Start recording, produce 50 chunks, simulate a gap. Emit `GapUploadCompleteEvent` with `highest_contiguous_sequence: 50` and `remaining_missing_ranges: []`. Verify the OPFS worker deletes all chunks ≤ 50 and the manifest reports `chunkCount: 0`. |

### Gap upload

| Test | Location | Assertion |
|---|---|---|
| `test_app_uploads_gap_chunks_on_reconnect` | `test_app` | Start recording, produce 20 chunks, disconnect WS, produce 10 more chunks (seq 21–30), reconnect. Verify `ResumeRecordingCommand` sent. On `RecordingResumedEvent` with `missing_ranges: [{start: 21, end: 30}]`, verify the app uploads chunks 21–30 via `POST /chunks`. |
| `test_app_sends_resume_command_with_opfs_sequence` | `test_app` | Start recording, produce 30 chunks, disconnect WS. On reconnect, verify `ResumeRecordingCommand` is sent with `last_client_sequence: 30` (the value from the OPFS worker's manifest `lastSequence`). |
| `test_app_uploads_gap_chunks_on_stop` | `test_app` | Stop recording. On `RecordingStoppedEvent` with `missing_ranges: [{start: 35, end: 40}]`, verify the app reads those sequences from OPFS and uploads via `POST /chunks`. |
| `test_app_skips_corrupt_opfs_chunks_during_gap_upload` | `test_app` | Corrupt an OPFS chunk's CRC32C. During gap upload, verify the corrupt chunk is skipped, the upload proceeds with valid chunks, and a `local_buffer_corrupt_chunk` warning is surfaced. |
| `test_app_resumes_gap_upload_after_page_reload` | `test_app` | Simulate a stopped recording with remaining gaps (`missing_ranges: [{start: 45, end: 50}]`). "Close" the page, "reopen" it. Verify the app calls `GET /meetings/{id}/recording/missing-chunks`, reads the OPFS buffer, and resumes uploading gap chunks. |

### Health banners

| Test | Location | Assertion |
|---|---|---|
| `test_app_shows_reconnecting_banner_on_ws_disconnect` | `test_app` | Start recording, disconnect WebSocket. Verify amber "Reconnecting" banner appears. Reconnect. Verify banner clears. |
| `test_app_shows_degraded_banner_on_ml_unavailable` | `test_app` | Emit `RecordingHealthEvent` with `code: ml_unavailable`. Verify amber banner "Live insights paused. Audio is still recording." appears. Emit `RecordingHealthEvent` with `status: recovered`. Verify banner clears. |
| `test_app_shows_critical_banner_on_local_buffer_failure` | `test_app` | Emit `RecordingHealthEvent` with `code: local_buffer_unavailable`. Verify red banner "Local audio backup is unavailable." appears — red severity because the durability guarantee is weakened. |
| `test_app_renders_gap_upload_progress` | `test_app` | Start a gap upload of 100 chunks. Verify a progress indicator appears showing "Uploading recovered audio... (X of Y chunks)" and updates as batches complete. |

### Backpressure

| Test | Location | Assertion |
|---|---|---|
| `test_app_pauses_ws_sends_on_high_buffered_amount` | `test_app` | Send `buffered_amount` message to worker with 6 MB. Produce 5 audio chunks. Verify chunks are written to OPFS but no `send_audio` messages are sent to the main thread. Send `buffered_amount` with 0.5 MB. Verify queued chunks are drained as `send_audio` messages in sequence order. |

## Completion Checklist

- [ ] Code merged and deployed
- [ ] Bet progress tests pass (`./dev test bet meeting-recording`)
- [ ] Permanent service tests implemented per [testing strategy](/docs/principles/foundations/testing)
- [ ] Code review completed
- [ ] API review completed (if new or modified API surfaces)
- [ ] Testing review completed
- [ ] System documentation updated (architecture, data flows, API reference, database reference, runbooks — as applicable)
