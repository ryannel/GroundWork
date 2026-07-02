## API Design

*The interfaces the bet introduces or changes — the contract beneath the surfaces, designed surface-neutral. The contract here serves every in-scope surface and presumes none; when only one surface is in scope, the latent agentic surface stands in as the second consumer: would a programmatic caller find this contract complete? The flows that exercise these interfaces live in `02-data-flows.md`; this file carries the interface design.*

*Each entry is a design commitment at design fidelity — full request shape, full response shape, error cases with caller guidance, design rationale — specific enough to implement from without clarification. The quality standard and a shallow/deep example pair live in `workflows/02-design.md`'s Quality Standard. The prose is the contract: Decomposition writes its proofs against these shapes, and Delivery implements against them and generates the real machine-readable contract (OpenAPI/AsyncAPI/proto) from the running code.*

*Single-app or embedded-core bets:* *the "interface" may be a module's public API or a key component boundary rather than a network endpoint — the contract discipline is identical (purpose, full signature, errors, rationale). For a single app with no cross-service API, focus this file on the key component interfaces the rest of the app depends on; if the bet introduces no meaningful interface boundary, say so in one line rather than padding it.*

#### [Service / Component / Boundary Name]

**`METHOD /path`** *(or the function/method signature for an embedded core)*

**Purpose:** [what this interface does and why it exists as a distinct boundary]

**Request:**
```
[full request shape — headers, params, body fields, each with its type, nullability, and allowed values where they matter]
```

**Response:**
```
[full response shape — every field with its type; enums spelled out; cursors and identifiers typed]
```

**Errors:**
- `4xx [reason]` — [when this fires and what the caller should do]
- `5xx [reason]` — [when this fires]

**Design rationale:** [key decisions — why this shape, why this boundary, tradeoffs accepted]

---
*(Add an entry for each interface introduced or changed by this bet)*
