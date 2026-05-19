# UX Design Cache

> This file captures approved outputs from each stage of the UX Design process. It is used to resume work and to compile the final `docs/ux-design.md`. Do not edit manually.

**Interface Type:** agentic-protocol

---

## Stage 1: Non-Functional Requirements

**Status:** done

### Proposed Non-Functional Requirements (NFRs) for the Agentic Protocol

**1. Agentic Efficiency**
*   **Response Latency:** Target near-instantaneous responses (<500ms) for most narrative segments to maintain immersion.
*   **Acceptable Delay:** A delay of up to 2 seconds is acceptable for significantly richer, more complex, and coherent narrative generation.
*   **Perceived Efficiency:** The system must deliver compelling and well-structured story segments quickly enough to prevent user perception of waiting, ensuring a smooth, engaging flow.
*   **Token Consciousness:** Protocol design must consider token usage to optimize for speed and cost, balancing narrative richness with processing overhead.

**2. Context Persistence & Resumability**
*   **Cross-Session/Device Resumability:** Users must be able to resume a story from the exact point of interruption, across different sessions and devices, without loss of progress.
*   **Comprehensive State Memory:** The system must maintain a comprehensive, granular memory of:
    *   Full narrative history, including all user choices and their immediate consequences.
    *   Current character states (e.g., health, inventory, relationships, significant traits).
    *   Current world state (e.g., environment, location, object states, established lore, changes).
*   **Critical State Recovery:** Exact state recovery after unexpected interruptions (e.g., application crash, network loss) is absolutely critical and must be guaranteed.

**3. Authority Model**
*   **User Character Agency:** User input provides absolute, unmediated control over their character's actions, dialogue, and core intentions. This is non-negotiable.
*   **Agent Role:** The agent's role is to react to user input, describe the world's response, and portray non-player characters (NPCs).
*   **Guidance as Suggestion:** Agent-initiated "nudges" or narrative suggestions are acceptable for guidance or enrichment, but must always be presented as proposals or environmental developments, never as dictates for the user's character.
*   **Explicit Override:** Users must have clear, unambiguous mechanisms to accept, reject, or completely override any agent suggestion. Free-text user input always takes precedence over implicit agent suggestions.
*   **Agent Autonomy Boundaries:** Agent autonomy is strictly limited to generating world reactions, NPC behaviors, and the consequences of user choices to maintain narrative coherence. The agent must never make decisions *for* the user's character.

**4. Verification & Governance**
*   **Dynamic Consistency System:** Implement robust internal dynamic memory systems that actively reference and prioritize recent, significant events and core lore to ensure narrative coherence and build upon established facts, preventing contradictions.
*   **Multi-Layered Ethical Guardrails:**
    *   **Pre-filtering:** Essential for preventing the generation of harmful or explicit content.
    *   **Real-time Monitoring:** Continuously analyze generated content for adherence to ethical guidelines, flagging or reformulating deviations.
    *   **Human Post-hoc Review:** Critical safety net for edge cases and continuous improvement of ethical content generation.
*   **Causal Traceability:** The system must be able to explain the causal chain of narrative events based on past user choices, enhancing immersion and demonstrating the impact of agency.
*   **Human Oversight & Auditing:** Humans must be involved in auditing the AI's narrative generation for coherence, creativity, and adherence to the overall product vision through periodic reviews.

**5. Error Resilience**
*   **Critical Failure Avoidance:** The system must prioritize avoiding narrative dead ends, logical contradictions, AI hallucinations (nonsensical/irrelevant content), and unresponsiveness.
*   **Graceful Self-Correction:** The primary recovery strategy is silent, graceful self-correction, steering the narrative back on track without explicit user intervention.
*   **Immersive Error Communication:** If explicit communication is necessary, it must be framed within the story's context, guiding the user forward with minimal technical details.
*   **Absolute Data Integrity:** Maintaining the integrity of story state, character data, and world state is absolutely critical and non-negotiable, even during errors or system crashes.

**6. Interoperability Across Agent Runtimes**
*   **Agent Agnosticism:** The core interaction logic must be designed to be as agent-agnostic as possible, avoiding reliance on unique, model-specific features to ensure flexibility with evolving AI models.
*   **High Portability:** Core logic and data structures must be highly portable to facilitate adaptation to new AI backends and different platforms (e.g., mobile apps, desktop applications, other interactive experiences).
*   **Standardization Preference:** Adherence to existing or emerging standards for agent communication or data exchange is desired where practical, prioritizing custom solutions only if they offer clear, substantial, and otherwise unachievable benefits.

**7. Auditability & Traceability**
*   **Developer Internal Audit:** Extremely important for developers and administrators to review the AI's decision-making process and narrative flow for debugging, root cause analysis, optimization, and continuous improvement.
*   **Comprehensive Indefinite Logging:** All user inputs, AI internal reasoning (if technically feasible and not overly verbose), specific AI model outputs, and final narrative segments must be logged comprehensively and retained indefinitely for debugging, detailed analytics, and future research.
*   **High Determinism for Reproducibility:** The system must strive for a high degree of determinism to reproduce specific narrative paths and AI responses given the same initial conditions and user inputs, especially for core logic and state transitions, to aid debugging and testing.

**8. Security & Trust Boundaries**
*   **Paramount Data Privacy:** Collect only necessary user data, store it securely (encrypted at rest and in transit), limit access strictly to authorized personnel on a need-to-know basis, and maintain transparent user communication regarding data use.
*   **Multi-Layered Content Moderation:** Implement robust input validation and sanitization to prevent malicious inputs (e.g., prompt injection). Continuously monitor and filter AI-generated outputs for harmful, illegal, or inappropriate content using automated and human review processes.
*   **Critical System Integrity:** Protect core AI models, persistent story state, user authentication, and proprietary algorithms from unauthorized access, tampering, or denial-of-service attacks through industry-standard security practices, regular audits and penetration testing.
*   **Trust Through Consistent Experience:** Build and maintain user trust by consistently adhering to ethical guidelines, maintaining narrative coherence, and ensuring reliable AI responses without "breaking character." Transparency about the AI's nature is important, but the focus should be on delivering a high-quality, safe, and engaging experience.

---

## Stage 2: Inspiration Library

**Status:** done

### Inspiration Library

1.  **For State Management & Versioning (Addressing Context Persistence, Dynamic Consistency, Causal Traceability):**
    *   **Terraform's `plan-apply-verify` loop:** We will borrow the concept of a clear, auditable workflow for proposing, reviewing, and committing significant narrative state changes. This mechanism can ensure coherence and allow for human oversight before a story path is solidified.
    *   **Git's Distributed Version Control:** We will draw inspiration from Git's ability to manage divergent branches and merge them, applying this to how the system handles "infinite replayability" and the exploration of alternative narrative possibilities. This helps manage the complexity of multiple potential story timelines.
    *   **Event Sourcing:** We will adopt the principle of recording every user choice and AI-generated narrative segment as an immutable, time-ordered event. This provides a complete, reconstructible, and auditable history of the story's evolution, directly supporting comprehensive state memory, critical state recovery, and inherent causal traceability.

2.  **For Agent Communication & Internal Design (Addressing Authority Model, Agentic Efficiency, Immersive Error Communication):**
    *   **Language Server Protocol (LSP):** We will take inspiration from LSP's model of providing precise, structured, and on-demand contextual information. This will guide how our agent delivers "nudges," clarifies ambiguities, or offers suggestions without being verbose or intrusive, ensuring efficient and immersive communication that respects user agency.
    *   **Unix Philosophy ("Do One Thing and Do It Well" & "Everything is a File"):** We will apply this philosophy to the agent's internal architecture, encouraging modular, focused AI components for improved agentic efficiency and predictable behavior. The "everything is a file" aspect reinforces the idea of transparent, auditable, and persistent state management through the filesystem, aligning with our needs for context persistence and auditability.

---

## Stage 3: Structure

**Status:** done

### Proposed Workspace Topology

**1. Filesystem Architecture**

*   **`config/`**: This directory would house all static configuration.
    *   **`config/global.json`**: For global system settings.
    *   **`config/stories/{story_template_id}.json`**: For initial story parameters and templates.
    *   **`config/agents/{agent_id}.json`**: For specific agent configurations (e.g., model parameters, personality traits).

*   **`data/`**: This is the heart of our persistent state, organized by active story.
    *   **`data/stories/{story_instance_id}/`**: Each subdirectory represents a unique, ongoing story instance.
        *   **`data/stories/{story_instance_id}/events/`**: This is where our Event Sourcing log lives. Each file here would be an immutable event record (e.g., `event_00001.json`, `event_00002.json`), ensuring full narrative history and traceability.
        *   **`data/stories/{story_instance_id}/state_snapshots/`**: Periodically, reconstructed states (snapshots) could be saved here (e.g., `snapshot_001.json`) for faster resumability, as inspired by Git's snapshotting.
        *   **`data/stories/{story_instance_id}/characters/{character_id}.json`**: Individual character states.
        *   **`data/stories/{story_instance_id}/world.json`**: The current global world state.

*   **`cache/`**: For transient and temporary data.
    *   **`cache/ai_intermediates/{session_id}/`**: Intermediate outputs from AI models during a single generation cycle.
    *   **`cache/sessions/{session_id}.json`**: Session-specific user interaction data, not critical for long-term persistence but useful for immediate context.

*   **`outputs/`**: For final narrative segments and other generated artifacts.
    *   **`outputs/stories/{story_instance_id}/narrative_log.txt`**: A plaintext log of all final narrative segments presented to the user.
    *   **`outputs/stories/{story_instance_id}/user_inputs.txt`**: A log of all raw user inputs.

*   **`agents/`**: This directory would contain the code and specific configurations for different AI "skills" or "modules."
    *   **`agents/narrative_generator/`**: Logic for generating story segments.
    *   **`agents/world_model_updater/`**: Logic for updating the world state based on events.
    *   **`agents/npc_behavior_model/`**: Logic for NPC reactions and actions.
    *   **`agents/content_moderator/`**: Logic for ethical guardrails and content filtering.

**2. State Management: Format, Schema, and Valid Transitions**

*   **Event Format & Schema (`data/stories/{story_instance_id}/events/`)**
    *   **Format:** JSON (e.g., `event_00001.json`)
    *   **Core Fields for Every Event:**
        *   `id`: Unique sequential identifier for the event within the story instance. Critical for ordering and traceability.
        *   `timestamp`: ISO 8601 format, recording when the event occurred.
        *   `event_type`: A string categorizing the event (e.g., `USER_INPUT`, `AGENT_NARRATIVE_GENERATED`).
        *   `source`: `USER` or `AGENT`, indicating who initiated or generated the event.
        *   `story_instance_id`: Reference to the specific story this event belongs to.
        *   `previous_event_id`: Reference to the `id` of the event immediately preceding this one, forming a robust causal chain.
        *   `payload`: A nested JSON object containing event-specific details.
    *   **Anticipated `event_type`s and `payload` examples:**
        *   **`USER_INPUT`**:
            ```json
            { "event_type": "USER_INPUT", "payload": { "raw_input": "I check the dusty bookshelf." } }
            ```
        *   **`AGENT_NARRATIVE_GENERATED`**:
            ```json
            { "event_type": "AGENT_NARRATIVE_GENERATED", "payload": { "narrative_text": "The shelf creaks, revealing a hidden compartment.", "generated_by_agent_id": "narrative_generator_v1" } }
            ```
        *   **`CHARACTER_STATE_CHANGE`**:
            ```json
            { "event_type": "CHARACTER_STATE_CHANGE", "payload": { "character_id": "player_char_1", "changes": { "inventory.add": "old key", "health.delta": -5 }, "reason": "found key, took minor damage" } }
            ```
        *   **`WORLD_STATE_UPDATE`**:
            ```json
            { "event_type": "WORLD_STATE_UPDATE", "payload": { "changes": { "locations.library.bookshelf.status": "searched", "global_flags.hidden_compartment_found": true }, "reason": "user discovered compartment" } }
            ```
        *   **`NARRATIVE_NUDGE_OFFERED`**:
            ```json
            { "event_type": "NARRATIVE_NUDGE_OFFERED", "payload": { "nudge_id": "nudge_001", "suggestion_text": "Perhaps you should investigate the old map?", "context": "user seems stuck" } }
            ```
        *   **`NARRATIVE_NUDGE_ACCEPTED` / `NARRATIVE_NUDGE_REJECTED`**:
            ```json
            { "event_type": "NARRATIVE_NUDGE_ACCEPTED", "payload": { "nudge_id": "nudge_001", "user_response": "Yes, I will look at the map." } }
            ```

*   **State Snapshot Format & Schema (`data/stories/{story_instance_id}/state_snapshots/`)**
    *   **Format:** JSON (e.g., `snapshot_001.json`)
    *   **Snapshot Schema:**
        *   `snapshot_id`: Unique identifier for this snapshot.
        *   `timestamp`: When the snapshot was created.
        *   `last_event_id`: The ID of the last event included in this snapshot. Crucial for understanding what state it represents.
        *   `story_summary`: A brief, high-level summary of the story's current status and key plot points.
        *   `player_character_state`: Full current state of the player's character (similar to `character.json` below).
        *   `npc_character_states`: An array of the full current states of all active NPCs.
        *   `world_state`: The full current world state (similar to `world.json` below).
        *   `active_quests`: Current status of all active quests.
        *   `inventory_global`: Any items not tied to a specific character but present in the world.
        *   `active_effects`: Any global narrative effects or timers.
    *   **Snapshot Triggering:**
        *   Automatically every `N` events (e.g., every 50-100 events).
        *   At significant narrative milestones (e.g., completing a major quest, entering a new region).
        *   Upon user-initiated save or session termination.
        *   Periodically during long active sessions (e.g., every 30 minutes).

*   **Character & World State Format & Schema**
    *   **`data/stories/{story_instance_id}/characters/{character_id}.json` (Player and NPCs)**
        *   **Format:** JSON
        *   **Key Fields:**
            *   `id`: Unique identifier for the character.
            *   `name`: Character's display name.
            *   `description`: A brief summary of the character.
            *   `archetype`: (e.g., "hero", "villain", "merchant", "companion")
            *   `traits`: Array of strings or objects describing personality traits, skills, or affiliations (e.g., `["brave", "curious", {"skill": "lockpicking", "level": 3}]`).
            *   `inventory`: Array of objects, each representing an item (`{"item_id": "sword_01", "name": "Rusty Sword", "quantity": 1}`).
            *   `relationships`: Map of other `character_id`s to their relationship status/score (e.g., `{"npc_elara": {"status": "friendly", "score": 75}}`).
            *   `current_location`: ID of the location the character is currently in.
            *   `health`: Current health/status points.
            *   `status_effects`: Array of active effects (e.g., `["poisoned", "blessed"]`).
            *   `current_goal`: (For NPCs) Their current narrative objective.
    *   **`data/stories/{story_instance_id}/world.json`**
        *   **Format:** JSON
        *   **Key Fields:**
            *   `current_location_id`: The ID of the primary location the user's character is currently experiencing.
            *   `global_flags`: Key-value pairs for global narrative states or lore elements (e.g., `{"ancient_evil_awakened": true, "moon_cycle": "full"}`).
            *   `known_lore`: A map where keys are lore topics and values are detailed descriptions or states (e.g., `{"history_of_eldoria": {"status": "partially known", "discovered_facts": ["ancient war", "lost king"]}}`).
            *   `active_quests`: Array of objects, each representing an active quest (`{"quest_id": "retrieve_artifact", "status": "in_progress", "objectives": [{"id": "find_map", "status": "completed"}, {"id": "enter_dungeon", "status": "active"}]}`).
            *   `locations`: Map of `location_id`s to their properties (e.g., `{"library": {"description": "dusty old library", "items_present": ["scroll_01", "book_03"], "exits": ["main_hall"], "status": "intact"}}`).
            *   `time_of_day`: Current in-game time.
            *   `weather`: Current in-game weather conditions.

**3. Skill and Tool Discovery**

*   **Discovery Mechanism:**
    *   **Primary Mechanism (Directory Convention + Individual Manifests):** Each distinct AI skill or module will reside in its own subdirectory within the `agents/` folder. For example, `agents/narrative_generator/`, `agents/world_model_updater/`.
    *   **Skill Manifest File:** Within each skill's directory, there *must* be a `skill.json` file. This file will serve as the machine-readable manifest for that specific skill.
    *   **System Scan:** The core system will discover available skills by scanning the `agents/` directory for subdirectories containing a `skill.json` file.

*   **Skill Manifest/Definition (`skill.json` Schema)**
    *   **Format:** JSON
    *   **Key Fields:**
        *   `id`: `string` - A unique, immutable identifier for the skill (e.g., `narrative_generator_v1`, `character_state_updater`).
        *   `name`: `string` - A human-readable name for the skill (e.g., "Narrative Generator", "Character State Updater").
        *   `description`: `string` - A clear, concise description of what the skill does and its primary function.
        *   `version`: `string` - The version of the skill (e.g., "1.0.0", "2.1-beta").
        *   `capabilities`: `array<string>` - A list of high-level categories or tags describing the skill's functionality.
        *   `inputs`: `object` - A JSON Schema defining the expected input parameters for the skill.
        *   `outputs`: `object` - A JSON Schema defining the expected output structure from the skill.
        *   `dependencies`: `array<string>` - A list of `id`s of other skills or external services this skill relies upon.
        *   `cost_model`: `object` (optional) - Information about the expected computational cost.
        *   `ethical_guidelines`: `array<string>` (optional) - Specific ethical constraints or considerations.

**4. Routing/Invocation**

*   **Intent-Based Routing:** The Orchestrator will analyze the current story state and user input to infer user intent and narrative requirements, then identify candidate skills based on `description` and `capabilities` in `skill.json` manifests.
*   **Contextual Matching & Prioritization:** Skills will be evaluated based on `inputs` schema satisfaction, `dependencies`, `cost_model`, and internal heuristics for narrative flow. If multiple skills match, prioritization rules or meta-reasoning will be used.
*   **Invocation Contract:** The Orchestrator will construct input payload per `inputs` schema, invokes skill, validates output against `outputs` schema, and processes results.
*   **Ambiguity Resolution & Fallback:** Mechanisms for resolving ambiguous skill matches and providing graceful fallback responses if no suitable skill is found.

**5. Context Injection Strategy**

*   **Global Context Layer (Always Available, Read-Only):** Fundamental, unchanging system and story parameters (`config/global.json`, `config/stories/{story_template_id}.json`, `config/agents/{agent_id}.json`, core ethical guidelines). Injected as immutable reference.
*   **Story Instance Context Layer (Phase-Specific, Dynamic):** Most recent `state_snapshot`, limited window of recent `events` (e.g., 10-20), `world.json`, relevant `character.json` files. Dynamically assembled by Orchestrator based on `story_instance_id` and target skill requirements.
*   **Task-Specific Context Layer (Skill-Specific, Ephemeral):** `payload` of triggering `USER_INPUT`, intermediate results, specific parameters from intent analysis. Passed as direct input parameters to the invoked skill.
*   **Context Budget Management:** Orchestrator monitors token count. Strategies include summarization, pruning, prioritization, dynamic retrieval for deep history, and caching for file read optimization.

---

## Stage 4: Design Language

**Status:** done

### Stage 4 Synthesis: Interaction Language Direction

**Communication Posture:**
The AI agent will adopt the persona of an **omniscient, master storyteller**, akin to a seasoned narrator from a classic fantasy novel. Its communication will be engaging and evocative, yet fundamentally neutral and objective. It will facilitate an immersive experience rather than acting as a character within the story.

**Information Density & Readability:**
The agent will deliver **medium-length, detailed narrative blocks** (typically one to two compelling paragraphs) per turn. Narrative flow is paramount, with information and plot points seamlessly woven into the storytelling, unfolding gradually and organically. Text will utilize essential paragraph breaks, with sparing use of bolding/italics for emphasis. Scene descriptions will be vivid, and dialogue clearly demarcated and attributed, integrated naturally within the narrative. The pacing will be deliberate and engaging, capable of slight adjustments for in-game urgency.

**Colour Psychology & Mood:**
The agent will leverage descriptive language to craft a rich and dynamic emotional atmosphere. The predominant mood will be **adventurous and mysterious**, with versatility to evoke heroic triumph, tense dread, or melancholic reflection. The implied palette will be rich and varied, favoring deep, earthy, and atmospheric hues, but capable of stark contrasts and bright tones for dramatic effect. Descriptions will evoke wonder, tension, satisfaction, awe, and connection, with mood shifts dynamically reflecting narrative beats while maintaining overall story coherence.

**Surface & Depth Philosophy:**
The agent will strive for a high degree of **tangibility and sensory richness** in its descriptions. Objects and environments will feel concrete, emphasizing textures, weight, and precise spatial relationships. A balanced level of detail will be provided, with surface details consistently present and depth details implied or revealed contextually. Interaction feedback will be multi-sensory (tactile, auditory, olfactory, proprioceptive). The described world will adhere to its *own established physics*, seamlessly integrating fantastical elements, with rare abstract elements serving distinct narrative purposes.

**Motion & Feedback:**
The agent will excel at describing **dynamic motion and vivid feedback**. Fast actions will be concise and impactful; slow movements will be expansive and detailed. Consequences and reactions will be immediate and vivid, emphasizing player agency. Motion will be described with rich, multi-sensory detail. All described motion will adhere to the *established physics of the story world*. "Behind-the-scenes" agent actions (like nudges or state updates) will **not be explicitly reflected in the narrative**, manifesting seamlessly as organic story elements.

**Iconography & Imagery:**
Mental iconography and imagery will be **visually rich and evocative**, blending precise details with subtle symbolism, all within a **consistent high-fantasy aesthetic**. Imagery will be highly detailed and vivid, providing a strong foundation for user imagination. Common narrative archetypes and visual tropes will be leveraged for immersion, with subtle subversions to add depth and novelty.

**Tone of Voice & Microcopy:**
The agent's linguistic style will be **evocative, descriptive, and slightly formal**, reflecting a classic literary or high fantasy narrative voice that feels timeless. Prompts for user input will be open-ended and inviting, framed as narrative questions or invitations. Confirmations of user actions will be seamlessly integrated into the subsequent narrative, without explicit acknowledgements. User-facing error messages will be minimal, immersive, framed within the story, and gently steer the narrative or ask for clarification. **Absolute consistency of voice is paramount** across all communication.

**Data Visualisation (Text-Based):**
Structured information will be presented **seamlessly and contextually into the narrative**, primarily **triggered by explicit user inquiry**, and **framed as an "in-world" interaction**. The agent will first describe the act of accessing or recalling information within the story. Information will use clear text formatting (bullet points, bolding, indentation) and short, descriptive phrases, avoiding excessive detail unless specifically requested.

---

## Stage 5: Expert Translation & Review

**Status:** done

**Draft Location:** docs/ux-design.md

### Walkthrough Progress

- [x] Cluster 1: Identity (colour, typography, texture)
- [x] Cluster 2: Touch (depth, motion, interaction states)
- [x] Cluster 3: Polish (scrollbars, toasts, errors, loading, empty states, borders, responsive)
