---
id: checkout-local-daemon
title: Checkout-local daemon strict cut
status: accepted
createdAt: '2026-08-29'
updatedAt: '2026-08-29'
version: 1
tags: [arc42, initiative, daemon]
---

# Checkout-local daemon strict cut

## WHAT / WHY

Replace paired Computer execution with one reliable checkout-local launchd worker. The simplification removes unused remote identity, credential, transport and checkout ownership while preserving Validation-led runtime semantics and durable execution facts.

## Scope

Strict v21/v15/v11/v12/v14/v18/v2 contracts; singleton local runtime API/UI; SQLite claim/lease/fencing/events/terminal facts; Codex/Copilot polling daemon; unified CLI lifecycle; docs and tests. No migration, compatibility path, external write, merge, push, release or deploy.

## Trace

`goal-024` → `REQ-024` → QS-038–QS-040 → `adr-037` / CON-017 → BB-017 → RT-032 / DEP-007 → TEST-038–TEST-040 → EVID-038–EVID-040.
