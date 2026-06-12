# Gap Ledger

> Working file. Each brownfield phase appends the divergences from GroundWork standard it discovers. `groundwork-infra-adopt` consolidates this into the roadmap table of `docs/maturity.md` at the end of setup (model: `.agents/groundwork/skills/maturity-model.md`), and the bet loop reads it when planning every bet.

Each entry records what diverges, the standard it violates, a severity, and a recommendation. Severity and Recommendation are closed value sets defined by the maturity model — write the values exactly as spelled below, because the roadmap reuses these strings verbatim and a drifted spelling orphans the row.

**Severity** — exactly one of `blocks-delivery` | `standard-divergence` | `cosmetic`:

- **`blocks-delivery`** — undermines GroundWork's ability to deliver and verify work. The bet loop cannot run well around it. Examples: a service exposes routes with no machine-readable contract (the contract-driven bet loop depends on OpenAPI/AsyncAPI); no system-test harness exists (progress and proof-of-work cannot be tracked across services).
- **`standard-divergence`** — works, but off the pattern GroundWork's templates encode. Example: events cross services with no transactional outbox; a service has no health endpoint; config is hard-coded rather than externalised.
- **`cosmetic`** — naming, doc structure, minor layout.

**Recommendation** — exactly one of `fix-now` | `defer` | `blocks-delivery`:

- **`fix-now`** — worth resolving before the first bet.
- **`defer`** — real, but value lies elsewhere first.
- **`blocks-delivery`** — must be the first bet, or close to it. It shares its spelling with the severity tier but is a distinct value in a distinct column.

| Gap | Standard violated | Severity | Recommendation | Evidence |
|---|---|---|---|---|
<!-- One row per gap. Phases append; none rewrite prior rows. -->
