# Product Brief: KnowledgeLink MCP Server

## System Purpose

KnowledgeLink is an MCP server that gives AI coding assistants structured, searchable access to a company's internal knowledge base: engineering docs, runbooks, architecture decisions, and API references. When a developer asks their AI assistant about internal systems, it calls KnowledgeLink tools to fetch authoritative answers instead of hallucinating.

## Target Users

**Software Engineer** — Uses Cursor or Claude to get accurate answers about internal systems without leaving their editor.

**Platform / DevEx Engineer** — Owns the KnowledgeLink deployment, index configuration, and access control rules.

## Capabilities

- `search_docs(query, category?, limit?)` — semantic search, ranked results with source attribution
- `get_doc(id)` — full document retrieval, chunked for large docs
- `list_categories()` — available document categories and counts
- Freshness signals on all documents (`last_updated`, `confidence` score)
- Access control via API key scopes mapped to document categories
- Webhook endpoint for CI/CD-triggered re-indexing

## Constraints

- MCP protocol compliance for all compliant clients.
- Search latency ≤800ms p95 on 50K-document index. Retrieval ≤400ms.
- No PII in the index. Category-level access control as enforcement.
- Single-tenant deployment initially.
