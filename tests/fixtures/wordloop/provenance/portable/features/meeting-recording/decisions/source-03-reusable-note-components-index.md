# Frozen source: 03-reusable-note-components/index.mdx

---
title: "03 Reusable Note Components"
description: "Shared note components deliver full CRUD, search, and context linking on the notes page, meeting detail, and people detail."
audience: engineers
owner: product-platform
status: active
source_of_truth: meeting-recording bet
---
# 03 Reusable Note Components

## Goal

A single set of reusable note components powers full create, read, update, delete, search, and context linking across the `/notes` listing page, meeting detail notes section, and people detail notes tab, with consistent behaviour across surfaces.

## Why This Comes Now

Notes are the first user-authored artifact that spans multiple surfaces — global listing, meeting context, and people context. Before live recording introduces autosaved meeting notes and the finalization pipeline must preserve them, the note surface itself must be consistent and fully functional. Shared components now mean the later live notes milestone inherits a stable editor, persistence model, and display rather than forking behaviour across surfaces.

## Included Scope

- A shared note component library used by the `/notes` page, meeting detail notes section, and people detail notes tab.
- Full note CRUD on all three surfaces: create with rich text editor, edit inline or via composer, and delete with confirmation.
- Note search: text search across note content and tags.
- Tag management: add, remove, and filter by tags with the shared tag picker.
- Context linking: link notes to a person or meeting via the shared context link picker, with the correct context pre-filled when creating from a meeting or person page.
- Meeting-scoped note views: the meeting detail page shows notes linked to that meeting with full CRUD capability.
- Person-scoped note views: the people detail page shows notes linked to that person with full CRUD capability.
- Rich text editing: the shared composer and editor support markdown shortcuts, formatting toolbar, and preview.
- Note card display: consistent card rendering with extracted title, excerpt, tags, context badge, and timestamp across all surfaces.
- Consistent empty, loading, and error states across all three surfaces.

## Not Included

- Collaborative or shared notes between users.
- Autosave during live recording (addressed in the live notes milestone).
- Using notes as ML prompt context for synthesis.
- Note export, external sync, or notification triggers.
- Note versioning or revision history.
- Attachment support (images, files) within notes.

## Domain Slices

App-only milestone. Core and ML have no new work.

| # | Domain | Slice summary | Scaffold command | Complexity | Prerequisite |
|---|---|---|---|---|---|
| 1 | App | Shared NoteList, NoteCard, NoteComposer, NoteSearch, TagPicker, ContextLinkPicker components; full CRUD across `/notes`, meeting detail, and people detail | `./dev new slice meeting-recording 03-reusable-note-components app note-components` | M | Milestone 01 merged |

## Acceptance

These criteria map to `tests/bets/meeting-recording/test_milestone_03_reusable_note_components.py`. Run via `./dev test bet meeting-recording`.

- [ ] The `/notes` page, meeting detail notes section, and people detail notes tab render notes using the same shared components.
- [ ] User can create a note from all three surfaces.
- [ ] Creating a note from the meeting detail page pre-links it to that meeting.
- [ ] Creating a note from the people detail page pre-links it to that person.
- [ ] User can edit a note from all three surfaces using the shared composer or editor.
- [ ] User can delete a note with confirmation from all three surfaces.
- [ ] User can search notes by content text and tags.
- [ ] User can filter notes by tag.
- [ ] Meeting detail shows only notes linked to that meeting.
- [ ] People detail shows only notes linked to that person.
- [ ] Note cards display title, excerpt, tags, context badge, and timestamp consistently.
- [ ] Loading, empty, and error states are consistent across all three surfaces.
