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

<step n="2" goal="Elicit System Context from User">
<ask>I've scanned the repository and identified the core technology stack:
{{tech_stack}}

To establish the **Executive Summary** for this system, I need a bit of high-level context. Please briefly answer the following three questions:

1. **Primary Goal:** What is the 1-2 sentence core purpose of this system?
2. **Core Users:** Who are the primary users (human personas or downstream systems)?
3. **System Boundary:** What are the key external dependencies, and what is explicitly *out of scope* for this repository?

You can answer all at once, or we can go one by one.
</ask>
<action>Capture the user's responses as `{{primary_goal}}`, `{{core_users}}`, and `{{system_boundary}}`.</action>
</step>

<step n="3" goal="Generate Executive Summary">
<action>Read `templates/executive-summary.md`</action>
<action>Replace placeholders with the captured data.</action>
<action>Write the compiled document to `docs/executive-summary.md` (or the configured `docs_location`).</action>
<action>Update `groundwork.yaml` to set `setup_state: active`.</action>
<ask>I have generated the Executive Summary at `docs/executive-summary.md` and marked the GroundWork setup as `active`. 

We are now ready to begin extracting the architecture! Would you like me to start the Discovery scan (`workflows/discover.md`)?</ask>
</step>
```
