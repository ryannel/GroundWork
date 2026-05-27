# Design System: KnowledgeLink MCP Server

## 1. Product Personality

KnowledgeLink is an **agentic protocol product** — its primary consumers are AI assistants, not humans. The design system is therefore about tool schema precision, response structure, and token efficiency, not visual aesthetics. A human DevEx engineer will configure and monitor it via a CLI and config files; there is no GUI.

Tone: Precise. Unambiguous. Consistent. The AI assistant reading a KnowledgeLink response should never need to infer intent.

## 2. Track: Agentic Protocol

This design system follows the agentic-protocol track. There are no colour tokens, typography choices, or visual components. The "interface" is the MCP tool schema and the shape of tool responses.

## 3. Non-Functional Requirements

- **Token efficiency:** All tool responses must be as compact as possible without losing information. Verbose prose explanations have no place in tool output — structured data only.
- **Schema stability:** Tool input and output schemas must be versioned and backwards-compatible. Removing a field from a response is a breaking change.
- **Latency:** Search tool calls must return within 800ms at p95. Retrieval calls within 400ms.
- **Error clarity:** All error responses must include a machine-readable `code`, a human-readable `message`, and a `remediation` hint. AI assistants must be able to surface the remediation hint to the user.
- **Idempotency:** All read-only tool calls are inherently idempotent. The index-trigger webhook must be idempotent (duplicate triggers must not corrupt the index).
- **Context window respect:** When a search returns many results, the response must support a `limit` parameter. Default limit: 5. Maximum: 20. The response header must always include `total_count` so the caller knows whether to paginate.

## 4. Tool Schema Conventions

**Naming:** Tools use snake_case verb-noun naming: `search_docs`, `get_doc`, `list_categories`. No abbreviations.

**Input schemas:** All optional parameters have explicit defaults documented in the schema description. Required parameters come before optional ones. No nullable required parameters.

**Output schemas:** All responses include:
- `status`: `"ok"` or `"error"` (always present, always first)
- `data`: the payload (present on `"ok"`)
- `error`: `{ code, message, remediation }` (present on `"error"`)

**Timestamps:** ISO 8601 UTC strings. Never Unix timestamps. Format: `2026-05-26T12:00:00Z`.

**Confidence scores:** Float 0.0–1.0. Documented thresholds: ≥0.9 high confidence, 0.5–0.9 moderate, <0.5 stale/uncertain. AI assistants must surface a staleness warning when confidence < 0.7.

## 5. CLI Design (DevEx Interface)

The platform engineer interacts with KnowledgeLink via a CLI for index management and diagnostics.

**Command naming:** `knowledgelink <noun> <verb>` pattern. Example: `knowledgelink index rebuild`, `knowledgelink docs list`, `knowledgelink status`.

**Output format:** Human-readable by default. `--json` flag for machine-readable output in all commands. Exit codes: 0 success, 1 usage error, 2 system error.

**Progress indicators:** Long-running operations (index rebuild) print a progress line every 5 seconds. No spinners — they obscure output in log files.

## 6. Authentication Model

API key in `Authorization: Bearer <key>` header. Keys are scoped to one or more document categories. A key with no explicit category scope has access only to `public` documents.

Error when key lacks access to requested category:
```json
{
  "status": "error",
  "error": {
    "code": "ACCESS_DENIED",
    "message": "This API key does not have access to category 'security-restricted'.",
    "remediation": "Contact your platform team to request an expanded-scope key."
  }
}
```

## 7. Response Size Limits

- Search result snippets: 500 characters maximum per result.
- Full document retrieval: 50,000 characters maximum. Documents exceeding this are chunked; the response includes `chunk_index` and `total_chunks`.
- Category listings: always return the full list (expected to be small, under 50 categories).
