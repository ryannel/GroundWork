# Product Brief: KnowledgeLink MCP Server

## System Purpose

KnowledgeLink is an MCP (Model Context Protocol) server that gives AI coding assistants — Cursor, Claude, Copilot — structured, searchable access to a company's internal knowledge base: engineering docs, runbooks, architecture decisions, and API references. When a developer asks their AI assistant about internal systems, the assistant calls KnowledgeLink tools to fetch authoritative answers rather than hallucinating.

## The Problem

Internal documentation is scattered across Notion, Confluence, GitHub wikis, and shared drives. AI coding assistants have no way to access it, so they either hallucinate internal system behaviour or refuse to answer. Developers waste 20–40 minutes per week re-learning things that exist in docs they can't easily find. New engineers spend their first two weeks searching for basic system context.

## Target Users

**Software Engineer (primary)**
- Who: Backend and full-stack engineers using Cursor or Claude as their primary coding assistant.
- Job: Get accurate answers about internal systems — API contracts, service boundaries, deployment runbooks — without leaving their editor.
- Success: "Our internal service auth flow" returns the actual runbook, not a generic OAuth explanation.

**Platform / DevEx Engineer (secondary)**
- Who: The team responsible for internal tooling and developer experience.
- Job: Own the KnowledgeLink deployment, index configuration, and access control rules.
- Success: Can add a new doc source (e.g., a new GitHub repo) without writing custom integration code.

## Capabilities

**Structured Document Search**
Semantic search across the indexed knowledge base. Returns ranked results with source attribution. MCP tool: `search_docs(query, category?, limit?)`.

**Document Retrieval**
Fetch the full content of a specific document by ID or path. MCP tool: `get_doc(id)`.

**Category Browsing**
List available document categories and their document counts. Allows AI assistants to orient themselves before searching. MCP tool: `list_categories()`.

**Freshness Signals**
Each document carries a `last_updated` timestamp and a `confidence` score (how recently the indexer confirmed the content is current). AI assistants can surface staleness warnings.

**Access Control**
Documents are tagged with visibility scopes (e.g., `public`, `backend-team`, `security-restricted`). The MCP server enforces scope based on the API key used to authenticate the client.

**Index Triggers**
A webhook endpoint that CI/CD pipelines call when documentation repos are updated. Triggers re-indexing of changed documents without a full reindex.

## Constraints

- MCP protocol compliance: must implement the MCP spec's tool-call and streaming response patterns correctly so all compliant clients work without configuration.
- Latency: search responses must return within 800ms at p95 for a 50K-document index.
- No PII in the index: personally identifiable information (HR docs, personal data) must never be indexed. Category-level access control is the enforcement mechanism.
- Single-tenant initially: one company deployment, not a multi-tenant SaaS.

## Success Signal

A developer on the platform team reports that KnowledgeLink answered their AI assistant's question about an internal system correctly (matching the actual runbook) on the first try, without the assistant hallucinating.
