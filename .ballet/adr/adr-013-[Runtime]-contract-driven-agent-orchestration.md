---
id: adr-013-runtime-contract-driven-agent-orchestration
title: Contract-driven agent orchestration
status: accepted
createdAt: 2026-06-25T00:00:00.000Z
updatedAt: 2026-06-25T00:00:00.000Z
---

## Context

Ballet previously coupled event definitions, routing policies, agent prompts, and emitted events through a shared `AgentOutcome` shape and producer metadata. Agents received trigger event and runtime metadata in their prompt, and the runtime selected output events by searching compatible event definitions.

## Decision

Ballet runtime orchestration now follows:

```text
EVENT -> ROUTING POLICY -> AGENT INPUT -> AGENT OPERATION -> AGENT OUTPUT -> EMISSION POLICY -> EVENT
```

Contracts are versioned JSON Schema Draft 2020-12 resources. Event data, operation input, operation output, and emitted event data are validated at their respective boundaries. Routing and emission policies use deterministic condition and mapping ASTs. Agent operations select their own input and output contracts. Emission policies explicitly map operation output to event data and own technical gates such as git commit existence and failed-check rejection.

Loop Engineering groups existing routing and emission policies into versioned loop definitions. Runtime loop instances track correlation, run count, hop count, terminal events, and exhausted limits without adding loop metadata to agent prompts.

## Consequences

- Agents no longer know Ballet event envelopes, routing policy IDs, emission policy IDs, run IDs, correlation IDs, causation IDs, or loop metadata unless a routing input mapping deliberately includes a business-safe value.
- Event publication is explicit and no longer depends on `EventDefinition.producers`.
- Runtime audit state records operation input/output contract metadata, routing decisions, emission decisions, and loop context.
- Legacy configuration using producer-based event definitions or `match/action` policies must be migrated to contracts, operations, routing policies, emission policies, and loop definitions.
