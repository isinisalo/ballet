---
name: penpot-design
description: Inspect and create scoped Penpot wireframes and reusable components through Penpot MCP while preserving repository design authority and external-write safety.
---

# Penpot design

1. Read `DESIGN.md`, the Action input and the relevant arc42 flows before opening design work.
2. Confirm Penpot MCP is connected to the explicitly intended file, active tab and focused page. Start with read-only inspection of pages, components, tokens and styles.
3. Before any Penpot mutation, require exact human authorization for the file, page and intended change. Never place an MCP key, tokenized URL or credential in repository content, evidence, screenshots or logs.
4. For wireframes, cover accepted happy, empty, loading, error and recovery flows plus keyboard order and the 1440x900 and 390x844 contracts.
5. For reusable components, reuse existing tokens and component sets, define necessary variants and states, and keep names mappable to implementation boundaries. Do not create a second palette, typography or spacing truth.
6. Apply small reversible changes and record stable file, page and object references in the declared repository evidence. Update `DESIGN.md` only when its system-level contract changes.
7. If MCP, active scope or authorization is absent or changes mid-task, stop with `needs_input` before writing.

Penpot MCP behavior and safety: https://help.penpot.app/mcp/
