# GroundWork Implementation Tasks & Ideas

## Immediate Tasks
- [x] Remove automated pattern extraction and replace with Skill Assessment logic.
- [x] Integrate `skill-creator` into the GroundWork CLI installation (`npx groundwork init`).
- [ ] **Test CLI**: Execute `npx groundwork init` in a test repository (e.g., `video-generation`) to verify that all `.agents/skills` copy over correctly.
- [ ] **Implement Parsers**: Build the Python/Bash helper scripts that back the XML actions in `groundwork-setup` (e.g., parsing `openapi.yaml`, `schema.sql`, and `asyncapi.yaml`).
- [ ] **Build Update Engine**: Flesh out the `groundwork-update` skill to handle surgical, in-place diffing of architecture documents when specific source files change.
- [ ] **Technical Writing Skill**: Bring in/develop a dedicated technical writing skill (e.g., `groundwork-writer`) that helps maintain the docs, provides AI metadata (frontmatter/tags), and ensures the GroundWork Tone is enforced consistently.
- [ ] **Publishing**: Configure `package.json` testing scripts and prepare the package for NPM publication.

## Ideas Backlog
- *Add your ideas here...*
