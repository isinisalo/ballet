---
id: 0001-test-adr
title: Use Markdown-backed fixtures
status: accepted
createdAt: 2026-06-23
updatedAt: '2026-08-29'
version: 2
tags:
  - architecture
---

## Context

Ballet needs local project content.

## Decision

Use strict Project Config v21 plus Markdown Agent definitions, instructions, Direction documents and a repository-local Skill as the fixture source of project truth. Runtime state and Agent execution bindings remain machine-local.
