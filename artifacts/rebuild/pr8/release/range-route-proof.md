# Range map response

The frozen and release `/volvo-cars/areas/range/map.json` responses both return HTTP 200 and JSON. The complete release payload equals the checksum-verified `area:range` view shard. The replay program reads the frozen and release captures, plus the two checked current model shards. The adjacent compressed receipt identifies both response hashes, all 115 original cards and all 298 original technical rows.

- The area ID becomes `area:range`. The area prose, three activities, confidence and authored evidence count of 36 remain exact. The two authored relationship directions and one collaboration retain their complete wording. Their system IDs resolve through the authored aliases. The workspace, date, scope and limitation stay exact.
- All seven value-flow bands, two columns, 64 core links, two overview links and 38 captions retain order, wording, positions and other fields. The authored aliases explain every changed endpoint. The 178 original backing references remain in the same order, with 408 citations from the native landscape rows. The original flow data equals the frozen authored landscape data.
- The old 115 cards resolve by canonical identity. The 103 native components are declared in Assortment and Car Configuration Engine. Seven former cards are now unmapped-system boundaries, with empty component lists and explicit gaps. Autotrader, Google, Meta and Sentry resolve as workspace externals outside this authored Range selection. The car-offer topic resolves under Offers. The two in-area resource lists now carry 39 and 22 explicit IDs in place of counts. The remaining 2,046 gaps come from the checked area shard. The node preservation receipt separately covers the raw descriptions, ownership context and sources.
- The 855 native technical rows match the entire in-area projection of the checked canonical edges. There are 169 calls, 244 reads, 287 writes, 99 publications and 56 subscriptions. Each row carries its actual site and citation flag. Of 298 old rows, 283 match these occurrences. Two more retain the recorded writes while dropping the inferred owner reads. The other 12 were supported by authored flows and retain their exact step IDs there. The remaining topic subscription stays present in the canonical model as `sub:product-catalog-webjob-car-offer-published`, crossing from Offers into Assortment.

The original area declaration is in Volvo's `landscape.yaml` at line 11 and the detail at line 2355. The native declarations are at lines 7 and 2451, and the topic's alias is at line 355 of `aliases.yaml`. The retained topic is at line 363 of Offers' `system.yaml` and the subscription at line 11118 of Assortment's `contracts.yaml`. The receipt binds the individual lineage, derived-edge exception, evidence-count and node-preservation proofs by hash.

Replay from the code worktree:

```sh
python3 artifacts/rebuild/pr8/release/range-route-proof.py \
  artifacts/rebuild/baseline/volvo-cars \
  .workspaces/rebuild/pr8/http-release/volvo-cars \
  /tmp/range-route-proof.json
```
