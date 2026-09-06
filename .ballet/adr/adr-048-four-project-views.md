---
id: adr-048
title: Four project views with one repository-owned definition
status: accepted
createdAt: '2026-09-06'
updatedAt: '2026-09-06'
version: 1
tags: [project, authoring, approval, strict-cut]
---

# Four project views with one repository-owned definition

## Context and authorization

The project owner's explicit 2026-09-06 implementation request authorizes this product/design change, local code/data/document edits and validation. The Project menu must contain Overview, Event Storming, User Stories and ADRs in that order. It does not authorize story approvals, merge, push, publication or deployment.

The former Direction config duplicated repository Goals, Constraints, ADR metadata and Use Case acceptance content. Existing User Story cards already provide the required Role/Goal/Benefit and numbered Given/When/Then interaction. A second Use Case editor would retain competing behavioral truth. Drivers: [Overview outcomes](../overview.md#outcomes), REQ-025 and QS-046.

## Decision

1. `.ballet/overview.md` owns Purpose, Outcomes, Scope and Shared requirements in one editable Markdown document. These sections are not entities or approval workflows.
2. `.ballet/user-stories/<uuid>.md` owns each story. Story v2 keeps Role, Goal, Benefit, ordered acceptanceCriteria and related `adrIds` in strict YAML; additional `details` are stored only as the Markdown body. The structured UI edits this same document and keeps complete colored cards. The existing Event Storming model, canvas and `sources` mechanism remain unchanged. ADRs also read/write their Markdown directly.
3. A story has `draft | approved`, a monotonic `approvalRevision`, and optional current approval with human identity, time, revision and content hash. A dedicated trusted-human command requires both the saved byte hash and saved semantic hash. Create/update cannot carry approval fields. A semantic edit invalidates current approval; direct file edits are rechecked on every read. Git retains old approval history. Drafts never show an old approval as current.
4. The semantic hash includes version, ID, Role/Goal/Benefit, every ordered Given/When/Then criterion, the set of ADR IDs, and parsed CommonMark details. Plain-text whitespace, YAML serialization, line endings, CommonMark marker spelling, soft paragraph wrapping and list spread are presentation. CommonMark node structure, links, code whitespace and actual words remain meaningful. This is structural equivalence, not AI interpretation of paraphrases. The file hash still detects every byte change for save/approval conflicts.
5. Remove Direction from Project Config and Root Snapshot, including old document hashes and governance prompt copies. Project Config is v26, Root Snapshot v21 and SQLite v24 because persisted snapshots with the former mandatory Direction shape are incompatible. Task Envelope, role outcomes, prompt composition, ExecutionSpec, Feedback, Critic, Refinement and Run Evidence contracts retain their existing versions: no typed shape or gate changed there. Project documents enter agent context only through explicit instruction/Skill reading; no Overview/story snapshot or Run gate is added.
6. Replace `/project/goals`, `/project/constraints`, `/project/use-cases` and their API collections with `/project/overview` and `/api/overview`; preserve Event Storming, User Stories and ADR URLs. No alias, migration reader or dual write survives. Use the existing optimistic atomic Markdown repository, editors and conflict guards.

## Options considered

- Hiding menu entries preserves competing data models and fails the requested strict cut.
- Copying Use Case lists into more Story lists creates multiple acceptance sources and is rejected.
- Reusing the current Story editor and Markdown repository directly provides one source with the least additional structure; selected.
- Recalculating approval hashes under old human identities is invalid. All transformed stories start Draft; source files and old hashes are archived unchanged.

## Consequences and supersession

This supersedes only the project-definition collections, mirrored Direction snapshot and Use Case approval entity portions of ADR-034/035/041, and the affected workspace roster in ADR-047. Their execution, local-human authority, instruction-directed context and editor principles remain. ADR-046 Event Storming remains intact. Requirements are consolidated in Overview or Stories; architectural decisions and their reasons remain ADR content rather than being manufactured from requirements.

[Historical source archive](../history/project-definition-2026-09-06/README.md) and its manifest map the former 13 Use Cases to eight Draft stories and five shared requirement scopes. No historic semantic hash or approval is rewritten. Active instructions and traceability use the new sources. Historic evidence and accepted decision text retain their original terminology and commit context.

## Evidence and review trigger

[Delivery evidence](../arc42/initiatives/four-project-views/EVIDENCE.md) records exact automated and browser checks. Review this decision if another editable requirement source, an automatic story approval/Run gate, or loss of a previously agreed acceptance requirement is proposed.
