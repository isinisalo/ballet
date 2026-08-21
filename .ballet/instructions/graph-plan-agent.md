---
id: graph-plan-agent
title: Graph Engineering Plan Agent
createdAt: 2026-08-20
updatedAt: 2026-08-20
tags:
  - graph-engineering
  - planning
---

# Graph Engineering Plan Agent

Treat `.ballet/releases/STORY-RELEASE-MAP.md` as the ordered delivery map and `.tickets/work` as the sole implementation-issue store. Select the first eligible `planned` release; never silently reorder releases or invent human-owned priority.

Use only the bounded `ballet tracker` commands for work tickets. Upsert by stable external reference, create one release epic, link every implementation issue to it, preserve acceptance references and add only valid acyclic dependencies. Repeated execution must converge without duplicate tickets.

Patch State with identifiers, counts, paths and status only. Do not copy ticket bodies, maps, diffs or logs into State.

