# Phase 0: Executive Summary Generation

This workflow is executed to establish the high-level System Context before any deep architectural extraction begins. It prevents agents from getting lost in details by defining the "Why" and "Who".

```xml
<step n="1" goal="Discover the Technology Stack">
<action>Scan the project root and primary subdirectories for package managers and build files:
  - `package.json` (Node.js/Frontend)
  - `requirements.txt`, `pyproject.toml`, `Pipfile` (Python)
  - `go.mod` (Go)
  - `Cargo.toml` (Rust)
  - `pom.xml`, `build.gradle` (Java)
</action>
<action>Extract the primary languages, frameworks (e.g., React, FastAPI, Next.js), and major infrastructure dependencies (e.g., Prisma, SQLAlchemy, Kafka, Redis).</action>
<action>Format these findings into a concise markdown list: `{{tech_stack}}`</action>
</step>

<step n="2" goal="Elicit System Context via Expert Interview">
<action>Review the discovered tech stack: {{tech_stack}}</action>
<action>Your ultimate goal is to produce a top-tier Executive Summary by filling in the `templates/executive-summary.md` document. 
To do this, you must extract high-quality, precise details for these three template fields:
1. Primary Goal: A 1-2 sentence description of what the system does and the specific business/technical problem it solves.
2. Core Users: Identify 1-3 primary personas or downstream systems that interact with it.
3. System Boundary: Define what is strictly IN scope, what is explicitly OUT of scope, and any key external dependencies.
</action>
<action>Act as an expert technical interviewer. Initiate a fluid, multi-turn conversation to gather these details.

**INTERVIEW RULES:**
- **One at a time:** You MUST ask ONLY ONE question per turn. Never ask multiple questions at once.
- **Template-Driven:** Keep the end goal in mind. Ensure the answers you collect are detailed enough to produce a comprehensive, top-class executive summary for the template.
- **Fluid & Contextual:** Do not use a fixed script. Tailor your questions naturally based on the tech stack and the user's previous answers.
- **Probe for Depth:** If an answer is vague or lacks depth, ask a specific, probing follow-up question to draw out high-quality details before moving on.
</action>
<ask>I've scanned the repository and identified the core technology stack:
{{tech_stack}}

To generate a high-quality **Executive Summary**, I need to understand the context of the system. I'll ask you a few questions to get the details I need for the documentation.

Let's start with the big picture: based on this stack, what is the primary goal or core purpose of this system?</ask>
<action>Evaluate the user's response against the template requirements. Engage in a multi-turn conversation (using `<ask>`) following the INTERVIEW RULES until all three key areas are fully fleshed out with high-quality details.</action>
<action>Capture the finalized understanding as `{{primary_goal}}`, `{{core_users}}`, and `{{system_boundary}}`.</action>
</step>

<step n="5" goal="Generate Executive Summary">
<action>Read `templates/executive-summary.md`</action>
<action>Replace placeholders with the captured data.</action>
<action>Write the compiled document to `docs/executive-summary.md` (or the configured `docs_location`).</action>
<action>Update `groundwork.yaml` to set `setup_state: active`.</action>
<ask>I have generated the Executive Summary at `docs/executive-summary.md` and marked the GroundWork setup as `active`. 

We are now ready to begin extracting the architecture! Would you like me to start the Discovery scan (`workflows/discover.md`)?</ask>
</step>
```
