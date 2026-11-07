# Independent progress reader

The native plan context and standing reader load progress through `progress-store.ts`. The shared YAML reader retains the registered workspace path, duplicate-key checks and root error paths. The legacy plan store still exports the same progress reader and status query.

The schema registry uses the original `progress`, `progressEvent` and `date` definitions with the same Ajv options, formats, URI cache and error formatting. The root legacy plan validator compiles only when a legacy plan shape is requested. The progress reader has no dependency on the legacy plan store or fact validator.

The final paths passed 42 reader and standing integration tests and 37 progress and standing unit tests. The existing tests cover an empty progress file result, invalid YAML or shape errors, event-derived issue status, and append rules. Focused lint, formatting and whitespace checks passed. The CLI owner runs the real native CLI suite after switching its imports.

| Source | SHA-256 |
| --- | --- |
| `schema/legacy-plan.schema.json` | `ae502fd2c568795af782edad6a2268dea2b9a771b92938bc118eec076da827ae` |
| `src/infrastructure/plan-schema.ts` | `7cc86c44cbe2035b0a6aeedcefa5df572785a518395bd702f1ad0d2fc2095099` |
| `src/infrastructure/plan-yaml.ts` | `e7a9571fc747908eb5cfe19a563cb0161a0b2296797849daa8897b9a57e1a25f` |
| `src/infrastructure/progress-store.ts` | `b35e1b0b5af003f86e56289ccdcea446cb404c1691261f5cd717978d79355dce` |
| `src/infrastructure/plan-validator.ts` | `19a2bd904520d524d755797b4e6c85aeb0016951199e23ae92c37bbfa46244c0` |
| `src/infrastructure/plan-store.ts` | `59bec73d317ef0153e4e4e0e8676500f9fa9a2566f581ad590ad059422867f0d` |
| `src/infrastructure/model-standing.ts` | `fc4cc632b0237c20d36409ae8305e5781788b12a8cc565f1d038a2b887cc6788` |
