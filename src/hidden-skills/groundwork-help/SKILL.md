---
name: groundwork-help
description: 'Analyzes the current state of the repository documentation to recommend the next skill(s) to use. Use when the user asks for help, what to do next, or how to start with GroundWork.'
---

# GroundWork Help Orchestrator

## Purpose
Orient the user within the 4-stage GroundWork lifecycle (Initialization -> Extraction -> Maintenance -> Execution). By scanning the `docs/` folder and cross-referencing the `.agents/config/groundwork-help.csv` catalog, this skill tells the user exactly what phase they are in and what skill to trigger next.

## Constraints
1. **Never guess the state:** You must literally check the file system paths defined in `output-location` to determine if a phase is complete.
2. **Follow the CSV:** The `groundwork-help.csv` is the absolute source of truth for dependencies.
3. **Menu formatting:** Always present recommendations with their `[menu-code]` and `display-name`.

## Follow the instructions
Load `.agents/skills/groundwork-help/instructions.md` for the exact workflow and logic.
