# Design System: KnowledgeLink MCP Server

Agentic protocol track. No GUI. Interface is MCP tool schemas and terminal output.

## Key decisions

- **Track:** Agentic Protocol
- **Consumers:** AI coding assistants (Cursor, Claude, Copilot)
- **Tool naming:** snake_case verb-noun (`search_docs`, `get_doc`, `list_categories`)
- **Response envelope:** `{ status: "ok"|"error", data: {...} }` or `{ status: "error", error: { code, message, remediation } }`
- **Token efficiency:** Compact structured data only. No prose in tool responses.
- **Timestamps:** ISO 8601 UTC strings.
- **Confidence scores:** Float 0.0–1.0. Surface staleness warning when <0.7.
- **CLI for platform engineers:** `knowledgelink <noun> <verb>` pattern. `--json` flag on all commands. Exit codes: 0/1/2/3.

## App-shell architectural signals

- Search requires semantic similarity → vector embeddings + pgvector or dedicated vector store
- Category-level access control → API key validation middleware must run before any doc access
- CI/CD-triggered re-indexing → webhook receiver must be idempotent and queue-backed
