# Skill Benchmark: groundwork-system-catalog

**Model**: gpt-5.4-mini  
**Runs**: 1 per evaluation/configuration

| Metric | Rewritten skill | Original skill | Delta |
|---|---:|---:|---:|
| Pass rate | 80% | 100% | -0.20 |
| Time | 71.0s | 71.0s | +0.0s |
| Output-character proxy | 2064 | 2288 | -223 |

## Analyzer notes

- Eval 2 is non-discriminating: all 5 assertions pass in both configurations, so it does not explain the skill delta.
- Eval 1 is mostly non-discriminating too — 4/5 assertions pass in both configs; the only divergence is the normalized JSON/evidence check, which fails with_skill but passes baseline.
- Eval 3 is the clearest regression case: baseline passes 5/5, while with_skill drops to 3/5 because it misses exact key/keyspace preservation and the commit-SHA/evidence requirement.
- The benchmark delta is driven by a small number of assertion-level regressions rather than broad changes across every eval; there is no eval where with_skill clearly beats baseline.
- Time is flat at 71s for every run, so execution time does not discriminate between configurations in this benchmark.
- Token usage varies more than correctness: with_skill is cheaper on evals 1 and 3 but much more expensive on eval 2, creating high variance without a pass-rate gain.
- With_skill is less stable across evals than baseline (pass rates 1.0, 1.0, 0.6 vs. a steady 1.0), which suggests the skill output is sensitive to prompt framing.
- Token counts are output-character proxies because the synchronous task runner did not expose per-agent token usage.
