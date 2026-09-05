---
id: adr-046
title: Repository-owned visual Event Storming workspace
status: accepted
createdAt: '2026-09-05'
updatedAt: '2026-09-05'
version: 1
tags: [event-storming, repository-first, react-flow]
---

# Repository-owned visual Event Storming workspace

## Context and approval

Decision: the project owner explicitly approved implementation of the Project → Event Storming plan on 2026-09-05. They selected linked boards, local workshop use, the same files for agents and humans, fully colored notes, live shared note content, autosave and one canonical model document. The drivers are version-controlled project truth (goal-002), accessible visual authoring (goal-007) and QS-044.

## Decision

Project exposes a dedicated free-positioned React Flow workshop at `/project/event-storming`. Big Picture, Process Modelling and Software Design boards reference shared note identities. Board-local placements, frames, connections and pivotal emphasis are independent. This is a scoped design exception; ADR-045's deterministic Loop Engineering tree remains unchanged.

`.ballet/event-storming/model.md` is the only persisted source: strict v1 YAML frontmatter with preserved Markdown evidence. GET/PUT `/api/event-storming` reads files and atomically replaces the model with optimistic hashes and the existing authoring lock. A revision-fenced serial queue autosaves completed edits; conflicts retain local drafts. Board data never enters SQLite, Project Config, Root Snapshots or Run gates. Existing Work/Validation agents use the same format through project-local instructions and Skill guidance.

## Alternatives and consequences

Separate note/board files would improve Git conflict granularity but require multi-file transactional recovery. Independent copied notes would avoid global editing consequences but contradict the selected live shared model. A generic form editor would not provide the approved workshop experience. Real-time multiplayer and a board-specific AI dispatcher are out of scope.

The single-file format makes shared edits atomic and inspectable, at the cost of document-wide optimistic conflicts and a bounded model size. External concurrent editors must reload after conflicts. There is no implicit migration or merge, and this decision does not grant remote-write authority.

## Trace and review trigger

QS-044 → CON-019 → BB-019 → RT-035 → TEST-044 / EVID-044. Review this decision before adding multiplayer, changing storage ownership, exceeding the current bounded model size or giving the board execution/approval authority.
