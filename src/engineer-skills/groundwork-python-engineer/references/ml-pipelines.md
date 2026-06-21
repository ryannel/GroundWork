# ML Pipelines

## The Pipeline Contract

Every ML pipeline step follows the same structure:

1. **Receive a typed domain input** — no SDK types, no raw dicts
2. **Call a provider** through the port the core owns
3. **Validate the output** — confidence, shape, required fields — before it crosses the boundary
4. **Return a typed domain output** safe for downstream consumption

No step owns both inference and persistence. No step reaches into another step's domain. This composability makes each step independently testable and replaceable.

## Data Contracts

Domain models at pipeline boundaries use Pydantic with strict validation:

```python
from pydantic import BaseModel, Field

class Segment(BaseModel):
    id: int
    speaker: str
    start: float          # seconds — never string formats at domain boundaries
    end: float
    text: str
    confidence: float = Field(ge=0.0, le=1.0)

class ProcessedOutput(BaseModel):
    segments: list[Segment]
    metadata: OutputMetadata
```

## Confidence Validation

Filter low-confidence results before they enter domain logic. The threshold is configuration, not a literal:

```python
def validate_segments(
    segments: list[Segment],
    threshold: float,
) -> list[Segment]:
    valid = [s for s in segments if s.confidence >= threshold]
    if len(valid) < len(segments):
        logger.warning(
            "low_confidence_segments_filtered",
            total=len(segments),
            filtered=len(segments) - len(valid),
        )
    return valid
```

## Mapping at the Edge

Adapters map SDK responses to domain types at the boundary. Core logic never imports any external SDK:

```python
# src/<package>/adapters/external_api.py
class ExternalAPIClient:
    async def process(self, input_uri: str) -> ProcessedOutput:
        raw = await self._client.process(input_uri)
        return self._to_domain(raw)

    def _to_domain(self, raw) -> ProcessedOutput:
        return ProcessedOutput(
            segments=[
                Segment(id=i, speaker=u.speaker or "unknown", ...)
                for i, u in enumerate(raw.items or [])
            ],
            metadata=OutputMetadata(...),
        )
```

## Embedding Pipeline

### Batching
Never embed one item at a time. Batch requests reduce API cost and latency 10–100×.

### Versioning
Store model name and version alongside every vector. Queries against stale embeddings produce incorrect results. Validate dimensions at the boundary.

### Caching
Cache on text content + model name + model version. Embedding the same input twice is pure cost with no benefit.

## RAG Pipeline

Three composable, independently testable steps:

1. **Retrieve** — embed query, search vector store for top-k candidates
2. **Rerank** — score candidates for relevance, discard below threshold
3. **Generate** — pass reranked context to LLM with a version-controlled prompt

**Prompts are code.** Prompts live in version control as Python constants, go through PR review, and are covered by eval suites. A prompt edited outside version control is an untested code change.

## Streaming Pipeline

Use semantic endpointing: buffer until a natural speech boundary (pause, sentence end), then process the completed chunk. Fixed-duration chunking splits mid-word and produces incoherent outputs.

```python
class SemanticEndpointer:
    MIN_CHUNK_DURATION_S = 3.0
    MIN_SILENCE_MS = 500

    def should_process(self, buffer: AudioBuffer) -> bool:
        if buffer.duration < self.MIN_CHUNK_DURATION_S:
            return False
        if buffer.silence_since_ms < self.MIN_SILENCE_MS:
            return False
        return True
```

## Anti-Patterns

- **Raw SDK responses in domain logic.** Map at the adapter boundary.
- **Hardcoded thresholds.** Confidence scores belong in configuration.
- **Embedding one at a time.** Always batch.
- **Embedding without versioning.** Unqueryable after model change.
- **Prompts in runtime config.** Unreviewed, untested code changes.
- **Time-based audio chunking.** Semantic endpointing produces coherent chunks.
