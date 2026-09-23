# Original import review

This frozen review records the earlier import, its source disagreements, and evidence limitations. Its statements about missing delivery support describe the viewer at import time. The portable migration now represents the milestone structure separately; no implementation completion is inferred.

# Meeting Recording — first real bet in Groundwork

Groundwork can hold this bet’s product intent and connected technical specification. It cannot yet hold its delivery structure, evidence provenance or unresolved decisions as first-class data. The import makes those limits visible without making up missing facts.

[Open the imported bet](http://localhost:5174/f/meeting-recording) · [Start with recovery](http://localhost:5174/f/meeting-recording/flow?trace=journey%3Areconnect) · [Original screens](http://localhost:5174/f/meeting-recording/design/active_recording)

## Structure revision after the first review

The initial flat component list has been replaced by a typed system structure. App, Core and ML are the three services. Audio buffer is local storage inside App; Diagnostics is internal operational tooling grouped under Core. Postgres and object storage are infrastructure. AssemblyAI and OpenAI are external providers. Dependencies and reverse “used by” links are explicit; they never count as changes merely because a feature calls them. Service scope rolls up owned internals, and storage records now distinguish tables, objects and local files. The product overview now presents this boundary in an interactive dependency diagram and top-level cards. Audio buffer and Diagnostics are omitted from that overview and its filters; their records stay available for feature-level inspection. Selecting an internal component through an existing product link resolves to its owning service. This separates the product architecture from the detail needed to describe an individual feature. Original source snapshots remain unchanged.

## What was imported

The active bet is **Meeting Recording**, identified by the Work navigation’s Active Bets section and the pitch’s explicit Active status. The source author is Ryan Nel. Wordloop’s source repository was read only; all changes are in Groundwork.

| Source | Groundwork representation |
|---|---|
| Wordloop platform | One workspace and one Wordloop product, with owned App/Core/ML/storage components and external service participants |
| Active pitch + TDD overview | One `building` feature, brief, non-goals and six success criteria; five TDD criteria plus a milestone-derived preservation criterion |
| UI design and data flows | 20 curated journey actions and action-specific system maps |
| Four original PNGs | Local image references rendered inside the design viewer |
| Entity contract pages | 88 directional contract entries, including shared operations with separate callers and both conflicting upload routes |
| Postgres, infrastructure and audio docs | 21 storage entries: 19 SQL/mentioned records and two explicitly labelled local/object records |
| Milestone acceptance and slice test tables | 226 planned scenarios; counts and provenance below |
| 11 milestones and domain slices | Preserved in the delivery appendix and frozen source documents; the application has no milestone model |

This is a curated projection of the source, not a lossless conversion into the seven sections. The complete active-bet document tree and images are preserved with SHA-256 hashes in [source-manifest.json](source-manifest.json). That manifest records original paths, the docs checkout commit, import time, contract/test source mappings and a static inventory of test files. Local working copies are fingerprinted because a commit alone does not describe uncommitted content.

`building` is the closest available Groundwork stage to an active implementation bet; it does not certify completion. Ryan is mapped from the named bet author, not an independently verified delivery assignment. Workspace creation and feature update timestamps are import timestamps, not original bet creation or recent Wordloop implementation activity. The product kind is `service-system`, the nearest existing type to this web application and its services.

## What works well

- **The seven sections accept a real domain.** No page registration, seed array, custom Wordloop renderer or route change was needed to discover the workspace/product/feature.
- **Connections make the specification useful.** A recovery action leads to its gap-upload contracts, retained local audio and durable storage records. A stop action separates persisted intent, drain, gap repair, composition and finalization. These expose questions that were spread across documents.
- **Component scope works.** App, Core, ML and storage can be inspected within the same bet. External providers appear as participants without being listed as owned work to change.
- **Evidence remains honest.** Planned acceptance links improve traceability while the viewer still shows zero passing tests. Existing source checkboxes and test files are retained separately from actual execution evidence.
- **Incomplete source material stays visible.** Missing note API contracts, schema disagreements and unsupported storage definitions remain gaps rather than fabricated implementations.

## What does not fit yet

| Gap | What this bet demonstrates | Recommended next change |
|---|---|---|
| Bet → milestone → domain slice hierarchy | 11 ordered milestones, prerequisites, complexity and merge/code-generation gates do not fit a single feature stage. Making each milestone an unrelated feature would lose the common bet intent. | Add optional delivery milestones and slices beneath a feature/bet, with dependencies and acceptance links. Keep user-journey order separate from delivery order. |
| Provenance | Source paths currently live in notes and this companion manifest. A linked acceptance scenario is not an executable test, test run, environment or commit. | Add source references per item and separate scenario definitions from evidence records with run time, revision, environment and outcome. |
| Conflicts and decisions | Contradictory upload routes, task ownership and schema names have nowhere to be flagged structurally. Non-goals cannot substitute for open questions or decision history. | Add review issues/decisions with source references, owner and resolution state. |
| Protocol semantics | REST operations, binary WebSocket frames, commands, emitted events and Pub/Sub all squeeze into `method` plus free text. Shared authentication, replay, ordering, idempotency and error policy are retained in source prose. | Separate protocol, interaction kind and shared contract policies. Add request schemas and error shapes alongside response schemas. |
| Persistence kinds | Storage kinds now distinguish OPFS local files, GCS object records and SQL tables. Indexes, lifecycle transitions, foreign-key constraints and transaction boundaries still become notes. | Extend the new storage kinds with state machines and structured constraints. |
| Several journeys in one ordered list | Upload, reusable components, live recording, recovery and review are alternate or supporting paths, not one mandatory 20-step sequence. `branch` and notes carry this distinction only partially. | Group journey paths, with explicit branches and entry/exit points. |
| Scale | 88 contracts, 226 scenarios and a wide coverage matrix make one ungrouped feature difficult to scan. A provider boundary can also contain several operations. | Group/filter by milestone and capability; add search and progressive disclosure to contracts and tests. |
| Unverified change baselines | The TDD describes target state. Treating every listed field or endpoint as new or modified would manufacture a diff. | Retain the new neutral change state; require a verified baseline before rendering a full before/after schema. |
| Whole-product classification | The current product kinds contain no web application type. | Add a web application kind when product taxonomy is revisited. |

The existing flow graph can express phase-specific operations and decisions, as demonstrated by stop and recovery. Other imported flows are compact component-boundary summaries; they do not replace every sequence diagram’s concurrency, failure and timing detail. The originals remain the implementation reference.

## Small changes made during the import

1. Added `change: "unspecified"`, displayed as **Not assessed / Change not assessed**, so target contracts and storage do not claim an invented implementation delta. The overview includes this count. Only operations explicitly marked **New** in the source use `added`; their label reflects authored intent, not a fresh baseline comparison.
2. Allowed restricted root-relative raster paths under `/images/` and rendered image references inline. The original four PNGs were copied without modification. Traversal, executable file formats and unsafe URL schemes remain rejected.
3. Added validation coverage for those two format extensions and regenerated the JSON Schemas. No Wordloop services or acceptance tests were run.

## Source disagreements surfaced by the import

| Issue | Sources | How it is represented |
|---|---|---|
| Upload endpoint `/audio` vs `/upload` | [Audio contract](sources/tdd/contracts/audio.mdx) vs [M01 Core slice](sources/tdd/milestones/01-upload-finalizes-meeting/slice-core-upload-finalizes-meeting.mdx) | Both contract alternatives are visible in the upload action. Their presence does not mean both should be implemented. |
| Reconcile tasks vs skip task extraction | [M08](sources/tdd/milestones/08-live-tasks-and-reconciliation/index.mdx), [task contract](sources/tdd/contracts/task.mdx) and Flow 11 vs the exception in [UI journey](sources/tdd/ui-design.mdx) and the sequential-pipeline decision in [data flow](sources/tdd/data-flow.mdx) | The imported target follows the explicit reconciliation milestone/contract and flags the conflicting statements. User-owned work is preserved. |
| Field-level task ownership vs whole-task promotion | M08 says user-owned fields are tracked separately; the task contract promotes an edited task to `source: user` | Whole-task source promotion is the concrete contract currently shown; field-level semantics remain unresolved. |
| Unconditional losslessness vs bounded recovery | [TDD success criterion](sources/tdd/index.mdx) and UI “Nothing will be lost” language vs OPFS failure/quota/corruption, gap deadline and tab-close constraints | Losslessness stays a goal; scenarios distinguish recoverable chunks from explicit loss of durability. |
| Recording progress fields | [Recording contract](sources/tdd/contracts/recording.mdx): `last_received_sequence`, `highest_contiguous_sequence`, `missing_ranges`, `audio_version`; [SQL schema](sources/tdd/schemas/postgres.mdx): `last_audio_sequence`, `last_stored_sequence`, `gap_plan` | SQL is preserved as authored, with a note identifying the contract mismatch. No column mapping is assumed. |
| Speaker-state storage | [Data flow](sources/tdd/data-flow.mdx) uses `meeting_speaker_states`; SQL defines `meeting_speaker_labels` | Both names appear; the undefined record has no fabricated columns. |
| Recording history | [Infrastructure](sources/tdd/contracts/infrastructure.mdx) defines `recording_event_history`; SQL defines `recording_status_history` | Both are visible with their authored shapes. Whether they coexist or replace one another remains unresolved. |
| Rich-text notes vs plain live notes | UI design and [M03](sources/tdd/milestones/03-reusable-note-components/index.mdx) describe rich text; [M06](sources/tdd/milestones/06-live-notes/index.mdx) excludes it and specifies a textarea | The screen note makes the conflict explicit. `meetings.notes` remains distinct from context-linked `notes`. |
| Subtasks in the final experience | Task contract and UI describe nested task CRUD; M02 only displays subtasks and M08 excludes subtasks | The contract is preserved, but no invented delivery milestone is assigned to subtask CRUD. |
| Missing shared note contracts | M03 promises note CRUD, search, tags and context linking; no note entity contract page is included in this bet | The journey and acceptance requirements are imported with no invented endpoint. |

The pitch has no explicit appetite value despite its frontmatter description mentioning appetite. No time budget was invented. The TDD also leaves Safari OPFS capability, long-recording composition benchmarks and the provider API migration question open. These remain source questions, not current platform claims.

## Evidence and delivery status

Imported at `2026-09-05T19:22:03Z` from docs checkout `0e99c42746b46968168e07a55d6029853559936a`.

The 226 scenarios comprise **80 milestone acceptance rows**, **132 slice test-table rows**, and **14 explicitly authored cross-layer scenarios**. All are `planned`. The synthesized scenarios connect major success criteria and selected boundaries. Other links are based on explicit operation/table references; a missing link is not proof that Wordloop lacks a test.

The source inventory contains **22 test files** with **177 test methods**, inspected without executing them. The M04 document has seven checked acceptance boxes while the other milestone documents have unchecked boxes. Those checkboxes do not provide a current run, environment or revision, so no milestone is marked shipped and no scenario is marked passing.

The broad SQL target and contract pages do not provide verified before/after field trees. JSON examples remain examples; no response diff is synthesized from a sample payload.

## Delivery plan preserved from the source

The source sequence is upload first, then shared task/note components, then live capture, durability, notes, talking points, reconciliation, speakers, playback and hardening. This sequence is preserved separately from the user journey.

| # | Milestone | Source acceptance | Full source |
|---|---|---|---|
| 01 | Upload Finalizes Meeting | 0/7 boxes checked; no run imported | [Milestone](sources/tdd/milestones/01-upload-finalizes-meeting/index.mdx) |
| 02 | Reusable Task Components | 0/10 boxes checked; no run imported | [Milestone](sources/tdd/milestones/02-reusable-task-components/index.mdx) |
| 03 | Reusable Note Components | 0/12 boxes checked; no run imported | [Milestone](sources/tdd/milestones/03-reusable-note-components/index.mdx) |
| 04 | Live Transcript To Final Rebuild | 7/7 boxes checked; no run imported | [Milestone](sources/tdd/milestones/04-live-transcript-to-final-rebuild/index.mdx) |
| 05 | Live Audio Durability Recovery | 0/6 boxes checked; no run imported | [Milestone](sources/tdd/milestones/05-live-audio-durability-recovery/index.mdx) |
| 06 | Live Notes | 0/6 boxes checked; no run imported | [Milestone](sources/tdd/milestones/06-live-notes/index.mdx) |
| 07 | Live Talking Points | 0/6 boxes checked; no run imported | [Milestone](sources/tdd/milestones/07-live-talking-points/index.mdx) |
| 08 | Live Tasks And Reconciliation | 0/7 boxes checked; no run imported | [Milestone](sources/tdd/milestones/08-live-tasks-and-reconciliation/index.mdx) |
| 09 | Speaker Labelling | 0/6 boxes checked; no run imported | [Milestone](sources/tdd/milestones/09-speaker-labelling/index.mdx) |
| 10 | Audio Playback And Review | 0/6 boxes checked; no run imported | [Milestone](sources/tdd/milestones/10-audio-playback-and-review/index.mdx) |
| 11 | Recording Hardening | 0/7 boxes checked; no run imported | [Milestone](sources/tdd/milestones/11-recording-hardening/index.mdx) |

[Structured delivery snapshot](delivery-plan.json) preserves goals, rationale, scope, exclusions, domain slices, prerequisites and original checkboxes. It is a companion artifact, not an unregistered app document.

### 01 Upload Finalizes Meeting

A user uploads a recorded meeting and receives a finalized transcript, headline, summary, topics, talking points, and tasks without using live recording.

**Why now:** Upload finalization is the smallest shared proof of the meeting rebuild path. It establishes the canonical post-processing pipeline before live recording, recovery, notes, speakers, playback, or hardening depend on it.

**Domain slices and prerequisites (as authored):**

| # | Domain | Slice summary | Scaffold command | Complexity | Prerequisite |
|---|---|---|---|---|---|
| 1 | Core | DB schema, all REST endpoints, WebSocket events, and Pub/Sub outbox | `./dev new slice meeting-recording 01-upload-finalizes-meeting core upload-finalizes-meeting` | L | None |
| 2 | ML | Pub/Sub consumer, AssemblyAI batch transcription, OpenAI synthesis, and Core write-backs | `./dev new slice meeting-recording 01-upload-finalizes-meeting ml upload-finalizes-meeting` | M | Slice 1 merged + `./dev gen all` |
| 3 | App | Upload entry point, processing states, meeting list, meeting detail CRUD, finalized artifacts | `./dev new slice meeting-recording 01-upload-finalizes-meeting app upload-finalizes-meeting` | M | Slice 1 merged + `./dev gen all` |

### 02 Reusable Task Components

A single set of reusable task components powers full create, read, update, delete, and search on both the /tasks listing page and the meeting detail page, with consistent behaviour across surfaces.

**Why now:** Milestone 01 proves the finalization pipeline that produces tasks from uploaded audio. Before live recording layers draft tasks and reconciliation logic on top, the task surface itself must be consistent and fully functional. Building shared components now means every later milestone that touches tasks — live task capture, reconciliation, and review — inherits a stable, tested foundation rather than forking behaviour across surfaces.

**Domain slices and prerequisites (as authored):**

App-only milestone. Core and ML have no new work.

| # | Domain | Slice summary | Scaffold command | Complexity | Prerequisite |
|---|---|---|---|---|---|
| 1 | App | Shared TaskList, TaskItem, TaskForm, TaskSearch components; full CRUD and filtering on `/tasks` page and meeting detail | `./dev new slice meeting-recording 02-reusable-task-components app task-components` | M | Milestone 01 merged |

### 03 Reusable Note Components

A single set of reusable note components powers full create, read, update, delete, search, and context linking across the /notes listing page, meeting detail notes section, and people detail notes tab, with consistent behaviour across surfaces.

**Why now:** Notes are the first user-authored artifact that spans multiple surfaces — global listing, meeting context, and people context. Before live recording introduces autosaved meeting notes and the finalization pipeline must preserve them, the note surface itself must be consistent and fully functional. Shared components now mean the later live notes milestone inherits a stable editor, persistence model, and display rather than forking behaviour across surfaces.

**Domain slices and prerequisites (as authored):**

App-only milestone. Core and ML have no new work.

| # | Domain | Slice summary | Scaffold command | Complexity | Prerequisite |
|---|---|---|---|---|---|
| 1 | App | Shared NoteList, NoteCard, NoteComposer, NoteSearch, TagPicker, ContextLinkPicker components; full CRUD across `/notes`, meeting detail, and people detail | `./dev new slice meeting-recording 03-reusable-note-components app note-components` | M | Milestone 01 merged |

### 04 Live Transcript To Final Rebuild

A user records live audio, sees a live transcript during the meeting, and stops recording to rebuild the same final artifacts through the finalization path proven by Milestone 01.

**Why now:** Live recording should not create a separate finalization model. After upload proves the rebuild path, live recording can focus on capture and streaming while stop hands the recorded audio into the same final transcript and synthesis pipeline.

**Domain slices and prerequisites (as authored):**

| # | Domain | Slice summary | Scaffold command | Complexity | Prerequisite |
|---|---|---|---|---|---|
| 1 | Core | WebSocket recording commands, ML session orchestration, GCS audio segment storage, finalization handoff to the M01 pipeline | `./dev new slice meeting-recording 04-live-transcript-to-final-rebuild core live-recording-session` | L | Milestone 01 merged |
| 2 | ML | AssemblyAI streaming session, live `TranscriptSegmentProducedEvent` output, drain on stop, final batch rebuild via M01 pipeline | `./dev new slice meeting-recording 04-live-transcript-to-final-rebuild ml streaming-transcription` | M | Slice 1 merged + `./dev gen all` |
| 3 | App | "Start Recording" entry point (from New Meeting dropdown), live transcript panel, stop button, stop-to-finalization transition state | `./dev new slice meeting-recording 04-live-transcript-to-final-rebuild app live-recording-ui` | M | Slice 1 merged + `./dev gen all` |

### 05 Live Audio Durability Recovery

A live recording remains durable across normal connectivity interruptions, with recoverable audio gaps and clear health or degraded states for the user.

**Why now:** Once live recording feeds the final rebuild path, the next risk is losing source audio before finalization. Durability and recovery must be proven before layering notes, insights, tasks, speakers, and playback on top of the recording session.

**Domain slices and prerequisites (as authored):**

| # | Domain | Slice summary | Scaffold command | Complexity | Prerequisite |
|---|---|---|---|---|---|
| 1 | Core | Binary audio frame receipt, 2 s GCS segment storage, `highest_contiguous_sequence` tracking, gap detection, `POST /meetings/{id}/recording/chunks` for OPFS gap upload, `AudioStoredProgressEvent` | `./dev new slice meeting-recording 05-live-audio-durability-recovery core audio-durability` | L | Milestone 04 merged |
| 2 | App | OPFS shadow buffer worker, `MediaRecorder` → OPFS → WebSocket send pipeline, `bufferedAmount` backpressure, gap upload on reconnect/stop, `RecordingHealthEvent` banner states | `./dev new slice meeting-recording 05-live-audio-durability-recovery app recording-durability-ui` | L | Slice 1 merged |
| 3 | ML | Gap-tolerant audio input handling; tolerant behaviour when received sequences are non-contiguous | `./dev new slice meeting-recording 05-live-audio-durability-recovery ml transcription-recovery` | S | Milestone 04 merged |

### 06 Live Notes

A user can write private notes during a live recording, have them autosaved, and keep them attached to the meeting after finalization.

**Why now:** Durable live audio establishes that the recording session can survive instability. Notes are the first user-authored artifact layered onto the session and must prove autosave and preservation before generated live insights or task reconciliation add more mutable state.

**Domain slices and prerequisites (as authored):**

No ML slice for this milestone.

| # | Domain | Slice summary | Scaffold command | Complexity | Prerequisite |
|---|---|---|---|---|---|
| 1 | Core | `PATCH /meetings/{id}` notes field update; debounced write semantics; `EntityChangedEvent { entity: "meeting" }` broadcast | `./dev new slice meeting-recording 06-live-notes core live-notes` | S | Milestone 03 merged (shared note components) |
| 2 | App | Notes textarea autosave in the recording view (debounced `PATCH`); restore on refresh; display in finalized meeting detail via M03 shared note components | `./dev new slice meeting-recording 06-live-notes app live-notes-editor` | S | Slice 1 merged |

### 07 Live Talking Points

A user sees draft talking points during a live meeting, then receives final talking points from the final rebuild after recording stops.

**Why now:** After the recording, finalization, durability, and user notes surfaces are stable, the system can safely add generated live insight previews without confusing them with final rebuilt artifacts.

**Domain slices and prerequisites (as authored):**

| # | Domain | Slice summary | Scaffold command | Complexity | Prerequisite |
|---|---|---|---|---|---|
| 1 | Core | `POST /meetings/{id}/talking-points` ML write-back; `TalkingPointEvent` broadcast; `PUT /meetings/{id}/synthesis` final replacement; `SynthesisUpdatedEvent` broadcast | `./dev new slice meeting-recording 07-live-talking-points core live-talking-points` | S | Milestone 04 merged |
| 2 | ML | Batched insight pipeline producing `TalkingPointProducedEvent` every N transcript segments; final talking points in post-meeting synthesis | `./dev new slice meeting-recording 07-live-talking-points ml live-talking-points` | M | Slice 1 merged + `./dev gen all` |
| 3 | App | Draft talking points panel in the recording view; provisional label; replace with final on `SynthesisUpdatedEvent` | `./dev new slice meeting-recording 07-live-talking-points app live-talking-points-ui` | S | Slice 1 merged |

### 08 Live Tasks And Reconciliation

A user can work with live extracted tasks during a meeting, create or edit tasks manually, and have final task reconciliation preserve user-owned edits after rebuild.

**Why now:** Tasks introduce generated state that users can modify. They belong after live insights because reconciliation rules must distinguish draft machine output from user-owned task changes before final artifacts replace provisional ones.

**Domain slices and prerequisites (as authored):**

| # | Domain | Slice summary | Scaffold command | Complexity | Prerequisite |
|---|---|---|---|---|---|
| 1 | Core | `source` field ownership tracking (`user` / `system`); `PUT /meetings/{id}/tasks/system` reconciliation semantics (preserve `source: user`, replace unedited `source: system`); `TaskEvent` broadcast during live session | `./dev new slice meeting-recording 08-live-tasks-and-reconciliation core task-reconciliation` | M | Milestone 04 merged |
| 2 | ML | `TaskProducedEvent` emission from the same batched insight pipeline as talking points; final task candidates in `PUT /meetings/{id}/tasks/system` write-back | `./dev new slice meeting-recording 08-live-tasks-and-reconciliation ml live-task-extraction` | S | Slice 1 merged + `./dev gen all` |
| 3 | App | Live task list in recording view (via M02 shared components); reconciliation result visible on finalization; wires M02 library to the live session | `./dev new slice meeting-recording 08-live-tasks-and-reconciliation app live-task-ui` | S | Slices 1 + 2 merged; Milestone 02 merged |

### 09 Speaker Labelling

A user can assign transcript speaker labels to people, create missing people, and keep those assignments when the final transcript replaces provisional transcript output.

**Why now:** Speaker labels depend on transcript identity and final replacement semantics. They come after task reconciliation because both require user-owned metadata to survive regenerated ML output without being overwritten.

**Domain slices and prerequisites (as authored):**

| # | Domain | Slice summary | Scaffold command | Complexity | Prerequisite |
|---|---|---|---|---|---|
| 1 | Core | `POST /meetings/{id}/speaker-labels`; person lookup / create; `speaker_label → person_id` mapping persisted to `transcript_segments`; mapping survives `PUT /transcriptions/{id}/segments` replacement; `SpeakerStateUpdatedEvent` to ML during live session | `./dev new slice meeting-recording 09-speaker-labelling core speaker-assignment` | M | Milestone 04 merged |
| 2 | App | Speaker label display on transcript segments; inline assignment dropdown (existing person or create new); assignment optimistically applied; unassigned labels visually distinct | `./dev new slice meeting-recording 09-speaker-labelling app speaker-labelling-ui` | M | Slice 1 merged |
| 3 | ML | `speaker_label` field populated on `TranscriptSegmentProducedEvent` from AssemblyAI diarization; `SegmentFeaturesProducedEvent` for voice embeddings | `./dev new slice meeting-recording 09-speaker-labelling ml speaker-diarization` | S | Milestone 04 merged |

### 10 Audio Playback And Review

A user can review a finalized meeting with tabs, play the stored audio through a signed URL, see transcript highlighting synced to playback, and click transcript text to seek.

**Why now:** Playback relies on durable source audio, final transcript timestamps, and stable review artifacts. It follows speaker labelling so review can include the finalized transcript metadata users need to inspect.

**Domain slices and prerequisites (as authored):**

| # | Domain | Slice summary | Scaffold command | Complexity | Prerequisite |
|---|---|---|---|---|---|
| 1 | Core | `GET /meetings/{id}/audio-url` returning a time-limited GCS signed URL; `mime_type` and `duration_ms` in response | `./dev new slice meeting-recording 10-audio-playback-and-review core audio-url` | S | Milestone 05 merged (composed `audio.webm` exists) |
| 2 | ML | `start_ms` / `end_ms` timestamps on every final transcript segment from batch AssemblyAI output | `./dev new slice meeting-recording 10-audio-playback-and-review ml timestamped-transcript` | S | Milestone 04 merged |
| 3 | App | Audio player component wired to signed URL; active segment highlight synced to `currentTime`; click-to-seek on transcript rows | `./dev new slice meeting-recording 10-audio-playback-and-review app audio-playback-ui` | M | Slices 1 + 2 merged |

### 11 Recording Hardening

A live recording behaves predictably under real-world browser and session constraints, with clear guards, automatic stops, capability gates, and diagnostics.

**Why now:** The core user value is proven before hardening so edge-case policy can be tested against complete recording, finalization, notes, insights, tasks, speakers, and playback behaviour rather than a partial flow.

**Domain slices and prerequisites (as authored):**

| # | Domain | Slice summary | Scaffold command | Complexity | Prerequisite |
|---|---|---|---|---|---|
| 1 | Core | `max_duration_seconds` enforcement; `RecordingDurationWarningEvent` and auto-stop; session lock preventing a second active recording per user; `recording_event_history` diagnostics table | `./dev new slice meeting-recording 11-recording-hardening core recording-limits` | M | Milestone 05 merged |
| 2 | ML | `no_audio_detected` health signal; unusable-audio detection emitted as `RecordingHealthEvent` domain signal | `./dev new slice meeting-recording 11-recording-hardening ml recording-health-signals` | S | Milestone 04 merged |
| 3 | App | `MediaRecorder` / OPFS capability gate before recording starts; multi-tab guard (disable Start if another tab has an active session via `has_active_recording` filter); no-audio warning banner; auto-stop countdown overlay | `./dev new slice meeting-recording 11-recording-hardening app recording-hardening-ui` | M | Slices 1 + 2 merged |

## Verification

Groundwork content validation, generated-schema checks, unit tests, lint and production build pass. The browser review covers the overview, original screen rendering, journey/flow navigation, contract inspection and test evidence presentation. The production build reports a bundle-size warning: real content is embedded in the local snapshot, adding to the case for feature-level content loading as datasets grow.

This verifies the imported plan and viewer. It does not verify microphone latency, audio durability, browser support or Wordloop delivery.
