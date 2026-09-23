# Frozen source: 04-live-transcript-to-final-rebuild/slice-app-live-recording-ui.mdx

---
title: "Live Recording UI"
description: "Start/Stop recording controls, OPFS buffer, and live transcript panel."
audience: engineers
owner: product-platform
status: active
source_of_truth: meeting-recording bet
---
# Live Recording UI

> **Owner**: App Engineer
> **Domain**: app
> **Complexity**: M
> **Prerequisite**: Milestone 03 completed.

This slice delivers the frontend experience for real-time meeting transcription. It introduces the "Start Live Recording" entry point, manages the Web Audio API and OPFS Web Worker separation for audio capture, opens the WebSocket to Core, streams binary audio, and renders incoming `TranscriptSegmentEvent` payloads optimistically in a live transcript panel. Upon stopping, it transitions the user into the synthesis states built during Milestone 01.

## Required Capabilities

### Recording Controls & Capture
- [x] Provide a "Start Recording" button that acquires microphone permissions and connects the WebSocket.
- [x] Render a live recording banner indicating active session status.
- [x] Buffer raw audio in an OPFS shadow buffer via a dedicated Web Worker to prevent main-thread blocking.

### Transcript Rendering
- [x] Parse `TranscriptSegmentEvent` WebSocket payloads and render them in real time.
- [x] Implement optimistic auto-scroll for new live transcript words/sentences.
- [x] Render visual feedback (e.g., partial vs. finalized words) using event metadata.

### Resilience & Transitions
- [x] Display a degraded health warning if a `RecordingHealthEvent` is received.
- [x] Handle WebSocket disconnection by auto-reconnecting or failing over gracefully.
- [x] Provide a "Stop Recording" button that sends the WS stop command.
- [x] Upon stopping, transition the UI to the "Processing Summary" state to await the final rebuild.

## Dependencies

- Core Live Recording Session (WebSocket host).
- Milestone 01 Synthesis UI (for post-stop processing states).

## Domain Notes

**UI States:**
| State | Trigger | View Display |
|---|---|---|
| `idle` | Initial load | "Start Recording" available. |
| `active` | WS Connected | Recording banner red dot; Live transcript panel visible. |
| `degraded` | HealthEvent / WS lag | Warning banner: "Transcription is lagging, audio still safe." |
| `stopping` | "Stop" clicked | Loading spinner over transcript panel. |
| `finalizing` | WS closed gracefully | "Creating summary..." state (M01 UI). |

## Test Cases

| Test | Location | Assertion |
|---|---|---|
| `test_app_shows_recording_banner_when_session_starts` | `test_app` | Assert the recording banner and transcript panel appear when WS mock connects. |
| `test_app_renders_live_transcript_segments_as_they_arrive` | `test_app` | Assert mock WS transcript payloads are appended to the DOM. |
| `test_app_web_worker_buffers_audio_in_opfs` | `test_app` | Assert the Web Audio context posts chunks to the mocked OPFS worker. |
| `test_app_stop_recording_transitions_to_finalization_view` | `test_app` | Assert clicking stop transitions to the M01 processing view. |
| `test_app_shows_health_warning_on_degraded_event` | `test_app` | Assert a visual warning banner appears on `degraded` health events. |

## Completion Checklist

- [x] Code merged and deployed
- [x] Bet progress tests pass (`./dev test bet meeting-recording`)
- [ ] Permanent service tests implemented per testing strategy
- [x] Code review completed
- [x] API review completed (if new or modified API surfaces)
- [ ] Testing review completed
- [x] System documentation updated
