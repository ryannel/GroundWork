# Project Architecture: KnowledgeLink MCP Server

## 1. Technical Constraints

- **Protocol compliance:** Must implement the MCP specification correctly so all compliant AI clients work without custom configuration.
- **Latency:** Search ≤800ms p95. Retrieval ≤400ms. Vector similarity search is the bottleneck — index must fit in memory.
- **Data sensitivity:** No PII in the index. Category-level access control enforced at the API layer, not at the database layer.
- **Scale:** Single-tenant. Initial target: 50,000 documents. Must handle re-indexing of a 50K-doc corpus within 10 minutes.
- **Deployment:** Single GCP project. No Kubernetes in MVP — Cloud Run for the server, Cloud SQL for metadata.

## 2. Domain Topology

Two services:

- **MCP Server (Python):** Implements the MCP protocol. Exposes tools (`search_docs`, `get_doc`, `list_categories`). Handles API key validation and access control. Calls the vector search index for semantic queries. Fetches full documents from Cloud Storage or the metadata database.
- **Indexer Worker (Python):** Triggered by CI/CD webhook or manual `knowledgelink index rebuild` CLI command. Crawls configured document sources (GitHub repos, Confluence export), chunks and embeds documents, writes embeddings to pgvector and metadata to Cloud SQL.

**Rationale:** Separating the query path (MCP Server) from the indexing path (Indexer Worker) ensures that a slow re-index does not affect search latency. The MCP Server is always-on and latency-sensitive; the Indexer Worker is bursty and throughput-sensitive.

## 3. Capability Decisions

- **Vector storage:** pgvector extension on Cloud SQL PostgreSQL. Avoids an additional managed service for MVP. Will migrate to a dedicated vector store (Pinecone, Weaviate) if index grows beyond 500K chunks.
- **Document storage:** Google Cloud Storage for raw document content. Cloud SQL for metadata (title, category, last_updated, confidence, chunk offsets).
- **Authentication:** API key in `Authorization: Bearer` header. Keys stored hashed in Cloud SQL. Scoped to one or more categories. Middleware validates on every request before tool routing.
- **Indexing trigger:** Webhook receiver endpoint (`POST /index/trigger`) is idempotent. Uses a Cloud Tasks queue to prevent concurrent re-index runs from corrupting the index.
- **Embeddings:** Google text-embedding-004 via Vertex AI SDK. Batch embedding during indexing. No real-time embedding on search queries — queries are embedded at search time with the same model.

## 4. Component Boundaries

**MCP Server (Python):**
- Owns: MCP tool definitions, API key validation, search routing, response envelope formatting.
- Does Not Own: Document ingestion, embedding generation, raw document storage.
- Contracts: MCP protocol tools (`search_docs`, `get_doc`, `list_categories`), `POST /index/trigger` (webhook). Health: `GET /health`.

**Indexer Worker (Python):**
- Owns: Document crawling, chunking, embedding, pgvector and metadata writes.
- Does Not Own: Search query handling, API key management, MCP protocol.
- Contracts: Internal only — triggered by webhook queue, not directly callable by MCP clients.

## 5. Service Table

| Service | Generator | Language | Port | Health |
|---|---|---|---|---|
| `mcp-server` | `python-microservice` | Python | 8080 | GET /health |
| `indexer-worker` | `python-microservice` | Python | 8081 | GET /health |
