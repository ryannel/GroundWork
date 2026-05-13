# GroundWork Setup - Validation Checklist

## Discovery & State
- [ ] scan-state.json created/updated
- [ ] All expected services discovered and classified by language/framework
- [ ] Scan level confirmed (quick/deep/exhaustive)
- [ ] Resume capability functions if interrupted

## Contracts
- [ ] `contracts/api.md` created for all services
- [ ] `contracts/schema.md` created for all services
- [ ] `contracts/events.md` conforms to GroundWork Tone (tables, trigger context).
- [ ] `architecture.md` includes the `Agent Skill Status` section with the correct GitHub alert.
- [ ] API documents clearly state generation_mode (generated vs extracted)
- [ ] Event contracts include `published_when` and `consumed_by` context for data flow synthesis

## Working Knowledge
- [ ] `index.md` created for all services with annotated directory tree
- [ ] `architecture.md` created for all services (rules and layer boundaries)

## Execution & Writing Quality
- [ ] Document validation performed right after writing (section-level: all template headers exist and have content)
- [ ] Detailed findings IMMEDIATELY purged from context after writing (only 1-sentence summaries kept)
- [ ] Agent tone strictly adheres to GroundWork Tone (definitive, lists/tables, no guessing)

## System Synthesis
- [ ] Cross-service event chains assembled successfully
- [ ] `architecture/data-flow.md` generated with full system flows
- [ ] `services/*/data-flow.md` updated with their slice of the system chains
- [ ] Global ADRs from `architecture/decisions/` applied to relevant service `architecture.md` files
- [ ] Root `docs/index.md` created with links to all generated documentation

## Final Quality
- [ ] Formal scan for exact marker `_(To be completed)_` performed across all generated docs.
- [ ] User presented with interactive menu to generate missing sections if markers were found.
- [ ] No empty `_(To be completed)_` markers left in Critical sections (API, Events, Schema) if running in Deep/Exhaustive mode.
- [ ] Context purging maintained low memory usage (no massive memory blobs held).
