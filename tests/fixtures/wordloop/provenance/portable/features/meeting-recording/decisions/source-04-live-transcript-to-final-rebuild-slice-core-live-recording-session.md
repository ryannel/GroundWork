# Frozen source: 04-live-transcript-to-final-rebuild/slice-core-live-recording-session.mdx

---
title: "Live Recording Session"
description: "Domain execution constraints, capabilities, and test cases."
audience: engineers
owner: product-platform
status: active
source_of_truth: meeting-recording bet
---
# Live Recording Session

> **Owner**: AI
> **Domain**: core
> **Complexity**: L
> **Prerequisite**: Milestone 3 Completed

This slice achieves the core orchestration of a live audio recording session. It introduces the `meeting_recordings` schema, updates the asynchronous API specifications, and implements the `RecordingService` to coordinate the WebSocket lifecycle and manage state transitions from `active` to `stopping`.

## Required Capabilities

- [x] Create `meeting_recordings` schema with status enums and sequence tracking.
- [x] Define `StartRecordingCommand` and `StopRecordingCommand` WebSocket contracts in `asyncapi-ws.yaml`.
- [x] Implement the `RecordingService` orchestrator in Core.
- [x] Emit `com.wordloop.meeting.session.terminated.v1` to trigger ML finalization.
- [x] Persist live session state in Postgres.

## Dependencies

- Milestone 3 (`reusable-note-components`) must be merged and verified.

## Domain Notes

**Schema Notes:**
| Table | Keys | Description |
|---|---|---|
| `meeting_recordings` | `meeting_id` (PK) | Tracks the active recording session status and audio gap markers. |

**State Transitions:**
1. `active`: Session is actively receiving WebSocket audio chunks.
2. `stopping`: Client requested a stop; buffers are flushing.
3. `draining_ml`: Emitting the termination event to ML and awaiting final segments.
4. `completed`: Processed successfully.

## Test Cases

| Test | Location | Assertion |
|---|---|---|
| Start Recording Idempotency | `test_core` | Starting an already active recording returns `200 OK` (idempotent). |
| Start Recording Creates DB Record | `test_core` | The `meeting_recordings` table gets a new row in `active` state. |
| Stop Recording Transitions State | `test_core` | Stopping a recording sets status to `stopping` and publishes the termination event. |

## Completion Checklist

- [x] Code merged and deployed
- [x] Bet progress tests pass (`./dev test bet meeting-recording`)
- [ ] Permanent service tests implemented per testing strategy
- [x] Code review completed
- [x] API review completed
- [ ] Testing review completed
- [x] System documentation updated

