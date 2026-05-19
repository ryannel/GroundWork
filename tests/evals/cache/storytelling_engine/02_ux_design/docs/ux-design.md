# UX Design: Agentic Protocol Specification

**Version:** 1.0
**Date:** October 26, 2023

---

## 1. Introduction

This document specifies the foundational protocol for the AI-powered "Choose Your Own Adventure" storytelling engine. It integrates Non-Functional Requirements (NFRs), architectural inspirations, workspace topology, and interaction language principles to define a robust, immersive, and maintainable system. This protocol outlines how the system manages state, orchestrates AI agents, and communicates with the user.

---

## 2. Core Principles

The protocol is designed around the following core principles:

*   **User Agency Paramount:** Absolute user control over their character, with agent guidance always as a suggestion.
*   **Immersive Narrative Flow:** Seamless, engaging storytelling that prioritizes coherence and emotional resonance.
*   **Comprehensive Context Persistence:** Exact state recovery and granular memory across sessions and devices.
*   **Modular & Auditable Design:** Transparent, traceable operations for debugging, optimization, and ethical governance.
*   **Agentic Efficiency:** Optimized for responsive, high-quality narrative generation within performance and cost constraints.

---

## 3. Workspace Topology (Filesystem & State Management)

The system employs a clear, hierarchical filesystem structure, leveraging Event Sourcing and Git-inspired snapshotting for robust state management.

### 3.1. Filesystem Architecture

*   **`config/`**: This directory houses all static configuration.
    *   `config/global.json`: Global system settings.
    *   `config/stories/{story_template_id}.json`: Initial story parameters and templates.
    *   `config/agents/{agent_id}.json`: Specific agent configurations (e.g., model parameters, personality traits).
*   **`data/`**: This is the heart of our persistent state, organized by active story.
    *   **`data/stories/{story_instance_id}/`**: Each subdirectory represents a unique, ongoing story instance.
        *   **`data/stories/{story_instance_id}/events/`**: This is where our Event Sourcing log lives. Each file (`event_00001.json`, etc.) is an immutable event record.
        *   **`data/stories/{story_instance_id}/state_snapshots/`**: Periodically, reconstructed states (snapshots) could be saved here (`snapshot_001.json`, etc.) for faster resumability, as inspired by Git's snapshotting.
        *   **`data/stories/{story_instance_id}/characters/{character_id}.json`**: Individual character states.
        *   **`data/stories/{story_instance_id}/world.json`**: The current global world state.
*   **`cache/`**: For transient and temporary data.
    *   **`cache/ai_intermediates/{session_id}/`**: Intermediate outputs from AI models during a single generation cycle.
    *   **`cache/sessions/{session_id}.json`**: Session-specific user interaction data, not critical for long-term persistence but useful for immediate context.
*   **`outputs/`**: For final narrative segments and other generated artifacts.
    *   **`outputs/stories/{story_instance_id}/narrative_log.txt`**: A plaintext log of all final narrative segments presented to the user.
    *   **`outputs/stories/{story_instance_id}/user_inputs.txt`**: A log of all raw user inputs.
*   **`agents/`**: This directory contains the code and specific configurations for different AI "skills" or "modules."
    *   **`agents/{skill_id}/`**: Individual skill directories, each containing a `skill.json` manifest.

### 3.2. Event Format & Schema (`data/stories/{story_instance_id}/events/`)

*   **Format:** JSON (e.g., `event_00001.json`)
*   **Core Fields:**
    *   `id`: Unique sequential identifier.
    *   `timestamp`: ISO 8601 format.
    *   `event_type`: String categorizing the event (e.g., `USER_INPUT`, `AGENT_NARRATIVE_GENERATED`).
    *   `source`: `USER` or `AGENT`.
    *   `story_instance_id`: Reference to story.
    *   `previous_event_id`: Reference to the preceding event's `id`.
    *   `payload`: Event-specific details (JSON object).
*   **Anticipated `event_type`s:** `USER_INPUT`, `AGENT_NARRATIVE_GENERATED`, `CHARACTER_STATE_CHANGE`, `WORLD_STATE_UPDATE`, `NARRATIVE_NUDGE_OFFERED`, `NARRATIVE_NUDGE_ACCEPTED/REJECTED`.

### 3.3. State Snapshot Format & Schema (`data/stories/{story_instance_id}/state_snapshots/`)

*   **Format:** JSON (e.g., `snapshot_001.json`)
*   **Schema:** `snapshot_id`, `timestamp`, `last_event_id`, `story_summary`, `player_character_state`, `npc_character_states`, `world_state`, `active_quests`, `inventory_global`, `active_effects`.
*   **Triggering:** Every N events, at significant narrative milestones, upon user save/session termination, periodically during active sessions.

### 3.4. Character & World State Format & Schema

*   **`data/stories/{story_instance_id}/characters/{character_id}.json` (JSON):**
    *   `id`, `name`, `description`, `archetype`, `traits`, `inventory`, `relationships`, `current_location`, `health`, `status_effects`, `current_goal`.
*   **`data/stories/{story_instance_id}/world.json` (JSON):**
    *   `current_location_id`, `global_flags`, `known_lore`, `active_quests`, `locations`, `time_of_day`, `weather`.

---

## 4. Agentic Interaction Model (Skills & Orchestration)

The system leverages a modular agent architecture inspired by Unix philosophy and LSP, orchestrated by a central component.

### 4.1. Skill Discovery Mechanism

*   **Mechanism:** Directory conventions combined with explicit manifests. Each skill resides in `agents/{skill_id}/` and *must* contain a `skill.json` file.
*   **System Scan:** Core system scans `agents/` for subdirectories with `skill.json` for dynamic loading.

### 4.2. Skill Manifest/Definition (`skill.json` Schema)

*   **Format:** JSON
*   **Key Fields:**
    *   `id`: Unique, immutable identifier (e.g., `narrative_generator_v1`).
    *   `name`: Human-readable name.
    *   `description`: Concise function summary.
    *   `version`: Skill version.
    *   `capabilities`: High-level functionality tags (e.g., `["story_generation", "content_moderation"]`).
    *   `inputs`: JSON Schema defining expected input parameters.
    *   `outputs`: JSON Schema defining expected output structure.
    *   `dependencies`: List of `id`s of other skills/services.
    *   `cost_model` (optional): Computational cost estimates.
    *   `ethical_guidelines` (optional): Skill-specific ethical constraints.

### 4.3. Routing/Invocation Logic

*   **Agent Orchestrator:** Interprets user intent and narrative requirements, dynamically selects and invokes skills.
*   **Intent-Based Routing:** Orchestrator analyzes current story state and `USER_INPUT` to infer intent, matching against `skill.json` `description` and `capabilities`.
*   **Contextual Matching & Prioritization:** Evaluates skills based on `inputs` schema, ensuring context can satisfy requirements. Prioritization considers `dependencies`, `cost_model`, and internal heuristics.
*   **Invocation Contract:** Orchestrator constructs input payload per `inputs` schema, invokes skill, validates output against `outputs` schema, and processes results.
*   **Ambiguity Resolution & Fallback:** Prioritization rules or meta-reasoning for multiple matches. Generic narrative response or user clarification for no suitable skill.

### 4.4. Context Injection Strategy

Layered context injection, dynamically assembled for surgical efficiency:

*   **Global Context Layer (Read-Only):** `config/global.json`, `config/stories/{story_template_id}.json`, `config/agents/{agent_id}.json`, core ethical guidelines. Injected as immutable reference.
*   **Story Instance Context Layer (Phase-Specific, Dynamic):** Most recent `state_snapshot`, limited window of recent `events` (e.g., 10-20), `world.json`, relevant `character.json` files. Dynamically assembled by Orchestrator.
*   **Task-Specific Context Layer (Skill-Specific, Ephemeral):** `payload` of triggering `USER_INPUT`, intermediate results, specific parameters from intent analysis. Passed as direct input parameters to the skill.
*   **Context Budget Management:** Orchestrator monitors token count. Strategies include summarization, pruning, prioritization, dynamic retrieval for deep history, and caching for file read optimization.

---

## 5. User Interaction Language & Formatting

The agent communicates as an omniscient, master storyteller, prioritizing immersion and narrative quality.

### 5.1. General Tone & Posture

*   **Personality:** Engaging, evocative, neutral, and objective. A seasoned narrator.
*   **Formality:** Rich, descriptive, generally formal for narrative; slightly less formal but polished for guidance.
*   **Empathy/Emotional Range:** Reflects and describes emotional tones within narrative; never expresses its own emotions.
*   **Directness:** Direct and clear for world/consequence/NPC descriptions; subtly indirect for nudges (observations/opportunities).

### 5.2. Information Density & Readability

*   **Amount per turn:** Medium-length, detailed narrative blocks (1-2 compelling paragraphs).
*   **Flow:** Narrative flow paramount; information woven in, unfolding gradually.
*   **Formatting:** Essential paragraph breaks; sparing bold/italics for emphasis; vivid scene descriptions; clearly demarcated, attributed dialogue.
*   **Pacing:** Deliberate, engaging pace, adjusting slightly for in-game urgency.

### 5.3. Colour Psychology & Mood

*   **Overall Mood:** Adventurous and mysterious, with versatility for heroic triumph, tense dread, melancholic reflection.
*   **Implied Palette:** Rich and varied; deep, earthy, muted hues for mystery; stark contrasts and bright tones for dramatic effect.
*   **Emotional Resonance:** Evokes wonder, intrigue, tension, satisfaction, awe, connection.
*   **Consistency vs. Variation:** Shifts dynamically to reflect narrative beats and environment, while maintaining overall coherence.

### 5.4. Surface & Depth Philosophy

*   **Tangibility:** Objects/environments feel concrete; emphasis on textures, weight, spatial relationships.
*   **Detail Level:** Balanced; surface details consistent; depth details implied/revealed contextually.
*   **Interaction Feedback:** Multi-sensory (tactile, auditory, olfactory, proprioceptive).
*   **Consistency of Reality:** Adheres to established internal physics (real-world + fantastical); fantastical elements seamlessly integrated; rare abstract elements serve distinct narrative purpose.

### 5.5. Motion & Feedback

*   **Pacing of Action:** Fast actions: concise, impactful; slow movements: expansive, detailed.
*   **Consequence & Reaction:** Immediate and vivid descriptions, emphasizing direct causal links to user actions.
*   **Sensory Detail in Motion:** Rich, multi-sensory descriptions (auditory, visual, tactile, proprioceptive).
*   **Physics & Realism:** Adheres to established story world physics; cinematic descriptions maintain internal consistency.
*   **Feedback for Agent Actions:** "Behind-the-scenes" actions (nudges, state updates) manifest seamlessly as organic story elements; no explicit reflection.

### 5.6. Iconography & Imagery

*   **Descriptive Style:** Evocative and precise, with subtle symbolism/metaphor for abstract concepts.
*   **Visual Richness:** Highly detailed and vivid mental images, providing strong foundation for user imagination.
*   **Consistency of Aesthetic:** Consistent high-fantasy aesthetic (medieval-inspired, fantastical creatures, magic).
*   **Archetypes & Tropes:** Leverages common tropes for immersion, subtly subverting for novelty and depth.

### 5.7. Tone of Voice & Microcopy

*   **Overall Linguistic Style:** Evocative, descriptive, and slightly formal; classic literary/high fantasy, timeless.
*   **Microcopy for Prompts/Choices:** Open-ended, inviting, subtly guiding; framed as narrative questions/invitations.
*   **Confirmations/Feedback:** Seamlessly integrated into subsequent narrative; no explicit acknowledgements.
*   **Error Messages (User-Facing):** Minimal, immersive, story-contextual; gently steer narrative or ask clarification; never technical.
*   **Consistency of Voice:** Absolute consistency paramount across all communication.

### 5.8. Data Visualisation (Text-Based)

*   **Approach:** Seamlessly and contextually integrated into narrative, primarily triggered by explicit user inquiry, framed as "in-world" interaction.
*   **Framing:** Agent describes act of accessing/recalling information within story.
*   **Formatting:** Clear, concise text formatting (bullet points, bolding, indentation); short, descriptive phrases over raw numbers.
*   **Minimalism:** Only most relevant information, unless specifically requested.

---

## 6. Cross-Cutting Concerns (NFRs Applied)

This section outlines how the defined protocol elements address the Non-Functional Requirements.

*   **Agentic Efficiency:**
    *   **Response Latency:** Layered Context Injection and modular skill design aim for surgical context delivery, reducing token usage and processing time. `cost_model` in `skill.json` guides Orchestrator in selecting efficient skills.
    *   **Perceived Efficiency:** Achieved through medium-length narrative blocks, seamless integration of feedback, and immediate, vivid consequence descriptions.
*   **Context Persistence & Resumability:**
    *   **Cross-Session/Device Resumability & Critical State Recovery:** Guaranteed by the `data/stories/{story_instance_id}/events/` (Event Sourcing) and `data/stories/{story_instance_id}/state_snapshots/` architecture. All changes are recorded and reconstructible.
    *   **Comprehensive State Memory:** Ensured by detailed `events`, `state_snapshots`, `character.json`, and `world.json` schemas.
*   **Authority Model:**
    *   **User Character Agency:** Maintained by open-ended prompts, explicit override mechanisms for nudges, and the Orchestrator prioritizing user input over implicit agent suggestions. Agent autonomy strictly limited to world/NPC reactions.
*   **Verification & Governance:**
    *   **Dynamic Consistency System:** `data/stories/{story_instance_id}/events/` provides a complete history, and the Orchestrator's Context Injection Strategy ensures skills reference current `world.json` and `character.json`.
    *   **Multi-Layered Ethical Guardrails:** Implied by `ethical_guidelines` in `skill.json` and the `content_moderator` agent. Human oversight through `outputs/` logs.
    *   **Causal Traceability:** Inherent in the Event Sourcing model (`previous_event_id` and detailed `payloads`) and `outputs/` logs.
    *   **Human Oversight & Auditing:** Supported by comprehensive logging (`events/`, `outputs/`), `skill.json` descriptions, and the ability to review AI decision flow via logged events.
*   **Error Resilience:**
    *   **Critical Failure Avoidance:** Modular `agents/` design isolates failures. Robust input/output schemas for skills prevent malformed data propagation.
    *   **Recovery Strategy & User Experience:** Orchestrator's fallback mechanism and immersive error communication strategy ensure graceful self-correction or narrative-framed prompts.
    *   **Absolute Data Integrity:** Event Sourcing is inherently robust against data loss; snapshots provide additional recovery points.
*   **Interoperability Across Agent Runtimes:**
    *   **Agent Agnosticism & High Portability:** Achieved by the `skill.json` schema (defining clear inputs/outputs) and the Orchestrator's role in abstracting skill implementation. Core logic and data structures are JSON-based and decoupled from specific AI models.
    *   **Standardization Preference:** JSON schemas for communication and state facilitate future adherence to emerging standards.
*   **Auditability & Traceability:**
    *   **Developer Internal Audit:** Comprehensive `events/` log, detailed `skill.json` manifests, and `outputs/` logs provide full visibility into AI decision-making and narrative flow.
    *   **Comprehensive Indefinite Logging:** Ensured by the `events/` and `outputs/` directories, with detailed schemas.
    *   **High Determinism for Reproducibility:** Event Sourcing enables reconstruction of any past state. Clear input/output contracts for skills facilitate deterministic testing.
*   **Security & Trust Boundaries:**
    *   **Paramount Data Privacy:** Filesystem structure limits data collection to core functionality. Encryption and access control are assumed for persistent storage.
    *   **Content Moderation:** Handled by dedicated `content_moderator` skill and ethical guardrails in `skill.json`. Input validation is implicit in `inputs` schemas.
    *   **Critical System Integrity:** Protected by modular design, clear contracts, and assumed underlying infrastructure security practices.
    *   **Trust in AI:** Built through consistent application of Interaction Language principles (coherence, reliability, ethical conduct) and seamless narrative experience.
