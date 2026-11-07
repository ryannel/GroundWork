# Mutation evidence for the native cutover

GitHub's original result detected 10,603 of 15,468 mutations, or 68.55%, against the existing 75% threshold. The largest gaps were in the plan reader, area cards and facts, inspection and system maps.

The follow-up changes only tests. The assertions cover ordered plan sections and recorded revision states, actual before and after records, scoped aliases and absent execution, exact call, data and message directions, and native and retained map layout. The compact synthetic fixtures and their checked outputs stay separate from the frozen workspace baselines. The focused suites passed 96 tests. The three files adjusted for lint then passed their 42 tests again.

The first measurement on 11 affected files detected another 1,001 mutations. The next measured another 305, counting overlapping files once. The last local measurement uses fewer timeouts than the original GitHub run. Replacing only the checked reports with identical source and mutant identities projects 11,754 detections out of 15,468, or 75.99%. This is a local projection. GitHub's aggregate on the updated commit supplies the merge decision. [Exact report hashes and counts](mutation-comparison.json)

`mutation-reconcile.py` compares the original batch directory and one or more replacement report paths. It refuses incomplete results, duplicate source files, different mutation sets and a changed threshold. The refreshed consumer inventory still has 148 runtime rows and zero adapters. [Inventory](consumer-mutation-recheck.log)
