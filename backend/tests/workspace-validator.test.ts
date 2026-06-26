import { describe, expect, it } from "vitest";
import type { AppData } from "../shared/domain.js";
import type { ContractDefinition } from "../shared/contracts.js";
import type { AgentOperation } from "../shared/operations.js";
import type { RoutingPolicy } from "../shared/routing-policy.js";
import type { EmissionPolicy } from "../shared/emission-policy.js";
import { workspaceValidator } from "../workspace-validator.js";

const at = "2026-06-25T08:00:00.000Z";

const contract = (id: string, kind: ContractDefinition["kind"], schema: Record<string, unknown> = { type: "object", additionalProperties: true }): ContractDefinition => ({
  id,
  version: 1,
  name: id,
  description: id,
  kind,
  active: true,
  schema,
  examples: [],
  createdAt: at,
  updatedAt: at
});

const output = contract("output", "agent-output", {
  type: "object",
  additionalProperties: false,
  required: ["status", "summary"],
  properties: {
    status: { type: "string", enum: ["completed", "blocked", "needs_input", "failed"] },
    summary: { type: "string" },
    result: { type: "object", additionalProperties: true },
    evidence: { type: "object", additionalProperties: true }
  }
});

const operation: AgentOperation = {
  id: "developer/implement",
  version: 1,
  name: "Implement",
  description: "Implement.",
  active: true,
  agentId: "developer",
  instructions: "Do it.",
  inputContract: { id: "input", version: 1 },
  outputContract: { id: "output", version: 1 },
  emissionRequired: true,
  createdAt: at,
  updatedAt: at
};

const routingPolicy: RoutingPolicy = {
  id: "on-start",
  name: "On start",
  description: "Route.",
  active: true,
  consumes: { eventType: "start.v1" },
  dispatch: { operation: { id: operation.id, version: operation.version } },
  input: { object: { goal: { from: "/event/data/goal" } } },
  createdAt: at,
  updatedAt: at
};

const emissionPolicy: EmissionPolicy = {
  id: "emit-done",
  version: 1,
  name: "Emit done",
  description: "Emit.",
  active: true,
  observes: { operation: { id: operation.id, version: operation.version } },
  emissions: [{
    slot: "done",
    eventType: "done.v1",
    subject: { from: "/input/workItemId" },
    tags: { const: ["delivery"] },
    data: { object: {} }
  }],
  createdAt: at,
  updatedAt: at
};

const validData = (): AppData => ({
  projects: [],
  goals: [],
  adrs: [],
  agents: [{
    id: "developer",
    name: "Developer",
    description: "Developer.",
    instructions: "Do it.",
    skills: [],
    enabled: true,
    status: "offline",
    createdAt: at,
    updatedAt: at
  }],
  skills: [],
  runtimes: [],
  contracts: [
    contract("event-data", "event-data"),
    contract("input", "agent-input", {
      type: "object",
      additionalProperties: false,
      required: ["goal"],
      properties: {
        goal: { type: "string" }
      }
    }),
    output
  ],
  operations: [operation],
  policies: [routingPolicy],
  emissionPolicies: [emissionPolicy],
  loopDefinitions: [{
    id: "delivery",
    version: 1,
    name: "Delivery",
    description: "Delivery.",
    active: true,
    entryEventTypes: ["start.v1"],
    terminalEventTypes: ["done.v1"],
    routingPolicyIds: [routingPolicy.id],
    emissionPolicyIds: [emissionPolicy.id],
    limits: { maxHops: 10, maxRuns: 10, maxIterationsPerStep: 3 },
    createdAt: at,
    updatedAt: at
  }],
  loopInstances: [],
  eventDefinitions: [
    {
      id: "start",
      name: "Start",
      description: "Start.",
      active: true,
      eventType: "start.v1",
      tags: [],
      dataContract: { id: "event-data", version: 1 },
      examples: [],
      createdAt: at,
      updatedAt: at
    },
    {
      id: "done",
      name: "Done",
      description: "Done.",
      active: true,
      eventType: "done.v1",
      tags: [],
      dataContract: { id: "event-data", version: 1 },
      examples: [],
      createdAt: at,
      updatedAt: at
    }
  ],
  events: [],
  agentRuns: []
});

describe("WorkspaceValidator", () => {
  it("accepts a valid contract-driven workspace", () => {
    expect(workspaceValidator.validate(validData()).valid).toBe(true);
  });

  it("reports active Flows that include inactive routing or emission rules", () => {
    const data = validData();
    data.policies = [{ ...routingPolicy, active: false }];
    data.emissionPolicies = [{ ...emissionPolicy, active: false }];

    const result = workspaceValidator.validate(data);

    expect(result.valid).toBe(false);
    expect(result.diagnostics.map((diagnostic) => diagnostic.title)).toEqual(expect.arrayContaining([
      "Inactive routing rule",
      "Inactive emission rule"
    ]));
  });

  it("reports active Flows with ambiguous active emission rule versions", () => {
    const data = validData();
    data.emissionPolicies = [
      emissionPolicy,
      {
        ...emissionPolicy,
        version: 2,
        name: "Emit done v2"
      }
    ];

    const result = workspaceValidator.validate(data);

    expect(result.valid).toBe(false);
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        title: "Ambiguous emission rule version",
        explanation: "Delivery includes emit-done, but multiple active versions exist. Pause old versions or create a Flow membership that selects one version."
      })
    ]));
  });

  it("reports duplicate versioned identities and duplicate active event types", () => {
    const data = validData();
    data.contracts = [...data.contracts, { ...data.contracts[0]! }];
    data.eventDefinitions = [...data.eventDefinitions, { ...data.eventDefinitions[0]!, id: "start-copy" }];
    const result = workspaceValidator.validate(data);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.map((diagnostic) => diagnostic.title)).toEqual(expect.arrayContaining([
      "Duplicate version",
      "Duplicate active event type"
    ]));
  });

  it("reports missing references and invalid AST configurations", () => {
    const data = validData();
    data.policies = [{
      ...routingPolicy,
      consumes: { eventType: "missing.v1" },
      dispatch: { operation: { id: "missing", version: 1 } },
      when: { path: "not-a-pointer", op: "eq", value: "x" },
      input: { from: "not-a-pointer" }
    }];
    const result = workspaceValidator.validate(data);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.map((diagnostic) => diagnostic.title)).toEqual(expect.arrayContaining([
      "Missing trigger",
      "Missing target task",
      "Invalid condition",
      "Invalid field mapping"
    ]));
  });

  it("reports unsafe regex and invalid numeric condition values", () => {
    const data = validData();
    data.policies = [{
      ...routingPolicy,
      when: { path: "/event/data/goal", op: "matches", value: "(a+)+" }
    }];
    data.emissionPolicies = [{
      ...emissionPolicy,
      when: { path: "/output/result/score", op: "gte", value: "5" }
    }];

    const result = workspaceValidator.validate(data);

    expect(result.valid).toBe(false);
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        title: "Invalid condition",
        explanation: "matches condition pattern uses unsupported nested repetition."
      }),
      expect.objectContaining({
        title: "Invalid condition",
        explanation: "condition.value must be a number for gte."
      })
    ]));
  });

  it("reports invalid Flow safety limits", () => {
    const data = validData();
    const loop = data.loopDefinitions[0]!;
    data.loopDefinitions = [{
      ...loop,
      limits: {
        maxHops: -1,
        maxRuns: 1.5,
        maxIterationsPerStep: "many",
        deadlineSeconds: 0
      } as unknown as typeof loop.limits
    }];

    const result = workspaceValidator.validate(data);

    expect(result.valid).toBe(false);
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        title: "Invalid Flow safety limit",
        explanation: "Delivery maximum steps must be a whole number greater than or equal to 0."
      }),
      expect.objectContaining({
        title: "Invalid Flow safety limit",
        explanation: "Delivery maximum agent runs must be a whole number greater than or equal to 0."
      }),
      expect.objectContaining({
        title: "Invalid Flow safety limit",
        explanation: "Delivery maximum repetitions of one step must be a whole number greater than or equal to 0."
      }),
      expect.objectContaining({
        title: "Invalid Flow safety limit",
        explanation: "Delivery maximum duration must be a whole number greater than or equal to 1."
      })
    ]));
  });

  it("allows zero safety limits for Flows that intentionally stop immediately", () => {
    const data = validData();
    const loop = data.loopDefinitions[0]!;
    data.loopDefinitions = [{
      ...loop,
      limits: { maxHops: 0, maxRuns: 0, maxIterationsPerStep: 0 }
    }];

    expect(workspaceValidator.validate(data).valid).toBe(true);
  });

  it("reports invalid routing selection and invalid-input behavior", () => {
    const data = validData();
    data.policies = [{
      ...routingPolicy,
      selection: { mode: "single", group: 12 },
      onInvalidInput: "queue-anyway"
    } as unknown as RoutingPolicy];

    const result = workspaceValidator.validate(data);

    expect(result.valid).toBe(false);
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        title: "Invalid routing failure behavior",
        explanation: "On start must either skip invalid input or reject the triggering event."
      }),
      expect.objectContaining({
        title: "Invalid routing selection",
        explanation: "On start selection mode must be fan-out or exclusive."
      }),
      expect.objectContaining({
        title: "Invalid routing selection",
        explanation: "On start exclusive group must be text."
      })
    ]));
  });

  it("reports invalid emission technical gates", () => {
    const data = validData();
    data.emissionPolicies = [{
      ...emissionPolicy,
      onGateFailure: "pause_run",
      gates: [
        { type: "unknown_gate", path: "/output/summary" },
        { type: "required_value", path: "output.summary" },
        { type: "no_failed_checks", path: "/output/evidence/checks", required: "yes" }
      ]
    } as unknown as EmissionPolicy];

    const result = workspaceValidator.validate(data);

    expect(result.valid).toBe(false);
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        title: "Invalid gate failure behavior",
        explanation: "Emit done must either skip publishing or fail the run when a technical gate fails."
      }),
      expect.objectContaining({
        title: "Invalid technical gate",
        explanation: "Emit done gate 1 has unsupported type unknown_gate."
      }),
      expect.objectContaining({
        title: "Invalid technical gate",
        explanation: "JSON Pointer must start with \"/\": output.summary"
      }),
      expect.objectContaining({
        title: "Invalid technical gate",
        explanation: "Emit done gate 3 required setting must be true or false."
      })
    ]));
  });

  it("reports invalid emission result branch identity and deduplication templates", () => {
    const data = validData();
    data.emissionPolicies = [{
      ...emissionPolicy,
      emissions: [
        {
          ...emissionPolicy.emissions[0]!,
          slot: "",
          eventType: "",
          dedupeKey: "not-a-template"
        },
        {
          ...emissionPolicy.emissions[0]!,
          slot: "done",
          dedupeKey: { template: "emission:{{run/id}}" }
        }
      ]
    } as unknown as EmissionPolicy];

    const result = workspaceValidator.validate(data);

    expect(result.valid).toBe(false);
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        title: "Invalid result branch",
        explanation: "Emit done result branch 1 must have a branch name."
      }),
      expect.objectContaining({
        title: "Invalid result branch",
        explanation: "Emit done branch 1 must publish a named event."
      }),
      expect.objectContaining({
        title: "Invalid deduplication key",
        explanation: "Emit done branch 1 deduplication key must be configured as a template."
      }),
      expect.objectContaining({
        title: "Invalid deduplication key",
        explanation: "JSON Pointer must start with \"/\": run/id"
      })
    ]));
  });

  it("reports active routing to emission-required tasks without active result handling", () => {
    const data = validData();
    data.emissionPolicies = [];

    const result = workspaceValidator.validate(data);

    expect(result.valid).toBe(false);
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        title: "Missing result handling",
        explanation: "On start starts Implement, but that task requires a result event and no active emission rule publishes one."
      })
    ]));
  });

  it("reports empty active emission rules for emission-required tasks", () => {
    const data = validData();
    data.emissionPolicies = [{ ...emissionPolicy, emissions: [] }];

    const result = workspaceValidator.validate(data);

    expect(result.valid).toBe(false);
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        title: "Missing result handling",
        explanation: "On start starts Implement, but that task requires a result event and no active emission rule publishes one."
      })
    ]));
  });

  it("allows active routing without result handling when task emissions are optional", () => {
    const data = validData();
    data.operations = [{ ...operation, emissionRequired: false }];
    data.emissionPolicies = [];
    data.loopDefinitions = data.loopDefinitions.map((loop) => ({ ...loop, emissionPolicyIds: [] }));

    expect(workspaceValidator.validate(data).valid).toBe(true);
  });

  it("reports references to active contracts with the wrong purpose", () => {
    const data = validData();
    data.contracts = data.contracts.map((item) => {
      if (item.id === "event-data") return { ...item, kind: "agent-input" as const };
      if (item.id === "input") return { ...item, kind: "event-data" as const };
      if (item.id === "output") return { ...item, kind: "event-data" as const };
      return item;
    });

    const result = workspaceValidator.validate(data);

    expect(result.valid).toBe(false);
    expect(result.diagnostics.map((diagnostic) => diagnostic.title)).toEqual(expect.arrayContaining([
      "Wrong event data shape type",
      "Wrong input shape type",
      "Wrong output shape type"
    ]));
    expect(result.diagnostics.map((diagnostic) => diagnostic.explanation)).toEqual(expect.arrayContaining([
      "Start references event-data@1, but events must use an event data shape.",
      "Implement references input@1, but task inputs must use an agent input shape.",
      "Implement references output@1, but task outputs must use an agent output shape."
    ]));
  });

  it("requires active events to declare an event data shape", () => {
    const data = validData();
    data.eventDefinitions = data.eventDefinitions.map((event) =>
      event.id === "start"
        ? { ...event, dataContract: undefined }
        : event
    );

    const result = workspaceValidator.validate(data);

    expect(result.valid).toBe(false);
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        title: "Missing event data shape",
        explanation: "Start is active but does not declare an event data shape."
      })
    ]));
  });

  it("reports event examples that do not match their data shape", () => {
    const data = validData();
    data.contracts = [
      ...data.contracts.filter((item) => item.id !== "event-data"),
      contract("event-data", "event-data", {
        type: "object",
        additionalProperties: false,
        required: ["goal"],
        properties: {
          goal: { type: "string" }
        }
      })
    ];
    data.eventDefinitions = data.eventDefinitions.map((event) =>
      event.id === "start"
        ? { ...event, examples: [{ goal: 42 }] }
        : event
    );

    const result = workspaceValidator.validate(data);

    expect(result.valid).toBe(false);
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        title: "Example does not match event data shape",
        explanation: "Example 1 for Start does not match event-data@1."
      })
    ]));
  });

  it("reports limit-exceeded events that cannot accept the runtime reason payload", () => {
    const data = validData();
    data.contracts = [
      ...data.contracts.filter((item) => item.id !== "event-data"),
      contract("event-data", "event-data", {
        type: "object",
        additionalProperties: false,
        properties: {
          reason: { type: "number" }
        }
      })
    ];
    data.loopDefinitions = data.loopDefinitions.map((loop) => ({
      ...loop,
      onLimitExceeded: { eventType: "done.v1" }
    }));

    const result = workspaceValidator.validate(data);

    expect(result.valid).toBe(false);
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        title: "Invalid limit-exceeded event data shape",
        explanation: "Delivery publishes Done when a safety limit is exceeded, but event-data@1 does not accept the runtime reason payload."
      })
    ]));
  });

  it("reports limit-exceeded events without a data shape", () => {
    const data = validData();
    data.eventDefinitions = data.eventDefinitions.map((event) =>
      event.id === "done"
        ? { ...event, dataContract: undefined }
        : event
    );
    data.loopDefinitions = data.loopDefinitions.map((loop) => ({
      ...loop,
      onLimitExceeded: { eventType: "done.v1" }
    }));

    const result = workspaceValidator.validate(data);

    expect(result.valid).toBe(false);
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        title: "Invalid limit-exceeded event data shape",
        explanation: "Delivery publishes Done when a safety limit is exceeded, but that event has no data shape."
      })
    ]));
  });

  it("reports required target mappings and subject/tag type errors", () => {
    const data = validData();
    data.contracts = [
      ...data.contracts.filter((item) => item.id !== "event-data"),
      contract("event-data", "event-data", {
        type: "object",
        additionalProperties: false,
        required: ["summary"],
        properties: {
          summary: { type: "string" }
        }
      })
    ];
    data.policies = [{
      ...routingPolicy,
      input: { object: {} }
    }];
    data.emissionPolicies = [{
      ...emissionPolicy,
      emissions: [{
        ...emissionPolicy.emissions[0]!,
        subject: { const: { not: "text" } },
        tags: { const: "delivery" },
        data: { object: {} }
      }]
    }];

    const result = workspaceValidator.validate(data);

    expect(result.valid).toBe(false);
    expect(result.diagnostics.map((diagnostic) => diagnostic.title)).toEqual(expect.arrayContaining([
      "Missing required field mapping",
      "Invalid subject mapping",
      "Invalid tag mapping"
    ]));
    expect(result.diagnostics.filter((diagnostic) => diagnostic.title === "Missing required field mapping").map((diagnostic) => diagnostic.explanation)).toEqual(expect.arrayContaining([
      "Routing input mapping must map required field goal.",
      "done event data mapping must map required field summary."
    ]));
  });

  it("reports routing input mappings with incompatible static source and target types", () => {
    const data = validData();
    data.contracts = data.contracts.map((item) => {
      if (item.id === "event-data") {
        return contract("event-data", "event-data", {
          type: "object",
          additionalProperties: false,
          properties: {
            goal: { type: "number" },
            priority: { type: "string" }
          }
        });
      }
      if (item.id === "input") {
        return contract("input", "agent-input", {
          type: "object",
          additionalProperties: false,
          required: ["goal", "priority"],
          properties: {
            goal: { type: "string" },
            priority: { type: "number" }
          }
        });
      }
      return item;
    });
    data.policies = [{
      ...routingPolicy,
      input: {
        object: {
          goal: { from: "/event/data/goal" },
          priority: { const: "high" }
        }
      }
    }];

    const result = workspaceValidator.validate(data);

    expect(result.valid).toBe(false);
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        title: "Incompatible field mapping",
        explanation: "Routing input mapping field goal maps a number value, but the target field expects text."
      }),
      expect.objectContaining({
        title: "Incompatible field mapping",
        explanation: "Routing input mapping field priority maps a text value, but the target field expects number."
      })
    ]));
  });

  it("reports emission event data mappings with incompatible operation output types", () => {
    const data = validData();
    data.contracts = data.contracts.map((item) => {
      if (item.id === "event-data") {
        return contract("event-data", "event-data", {
          type: "object",
          additionalProperties: false,
          properties: {
            count: { type: "number" },
            summary: { type: "string" }
          }
        });
      }
      return item;
    });
    data.emissionPolicies = [{
      ...emissionPolicy,
      emissions: [{
        ...emissionPolicy.emissions[0]!,
        data: {
          object: {
            count: { from: "/output/summary" },
            summary: { const: 42 }
          }
        }
      }]
    }];

    const result = workspaceValidator.validate(data);

    expect(result.valid).toBe(false);
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        title: "Incompatible field mapping",
        explanation: "done event data mapping field count maps a text value, but the target field expects number."
      }),
      expect.objectContaining({
        title: "Incompatible field mapping",
        explanation: "done event data mapping field summary maps a number value, but the target field expects text."
      })
    ]));
  });

  it("reports subject and tag mappings from incompatible operation output fields", () => {
    const data = validData();
    data.contracts = data.contracts.map((item) =>
      item.id === "output"
        ? contract("output", "agent-output", {
            type: "object",
            additionalProperties: false,
            required: ["status", "summary"],
            properties: {
              status: { type: "string", enum: ["completed", "blocked", "needs_input", "failed"] },
              summary: { type: "string" },
              result: {
                type: "object",
                additionalProperties: false,
                properties: {
                  issueCount: { type: "number" },
                  reviewerTags: { type: "array", items: { type: "string" } }
                }
              },
              evidence: { type: "object", additionalProperties: true }
            }
          })
        : item
    );
    data.emissionPolicies = [{
      ...emissionPolicy,
      emissions: [{
        ...emissionPolicy.emissions[0]!,
        subject: { from: "/output/result/issueCount" },
        tags: { from: "/output/result/issueCount" }
      }]
    }];

    const result = workspaceValidator.validate(data);

    expect(result.valid).toBe(false);
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        title: "Invalid subject mapping",
        explanation: "done subject mapping maps a number value, but subjects must be text."
      }),
      expect.objectContaining({
        title: "Invalid tag mapping",
        explanation: "done tag mapping maps a number value, but tags must be a text list."
      })
    ]));
  });

  it("requires agent-output contracts to expose the full execution envelope", () => {
    const data = validData();
    data.contracts = data.contracts.map((item) =>
      item.id === "output"
        ? {
            ...item,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["status", "summary"],
              properties: {
                status: { type: "string", enum: ["completed", "blocked", "needs_input", "failed"] },
                summary: { type: "string" }
              }
            }
          }
        : item
    );

    const result = workspaceValidator.validate(data);

    expect(result.valid).toBe(false);
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        title: "Invalid data shape",
        explanation: expect.stringContaining("must define status, summary, result, and evidence")
      })
    ]));
  });

  it("blocks safe deletion when resources are referenced", () => {
    const operationResult = workspaceValidator.safeDelete(validData(), {
      type: "operation",
      id: operation.id,
      version: operation.version,
      label: operation.name
    });
    expect(operationResult.allowed).toBe(false);
    expect(operationResult.references.map((reference) => reference.type)).toEqual(expect.arrayContaining(["routing-policy", "emission-policy"]));

    const agentResult = workspaceValidator.safeDelete(validData(), {
      type: "agent",
      id: "developer",
      label: "Developer"
    });
    expect(agentResult.allowed).toBe(false);
    expect(agentResult.references).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "operation", id: operation.id, version: operation.version })
    ]));

    const skillRuntimeData = validData();
    skillRuntimeData.skills = [{ id: "typescript", name: "TypeScript", description: "TypeScript work.", metadata: {}, enabled: true }];
    skillRuntimeData.runtimes = [{
      id: "codex-cli",
      name: "Codex CLI",
      type: "codex-cli",
      command: "codex",
      config: {},
      enabled: true,
      createdAt: at,
      updatedAt: at
    }];
    skillRuntimeData.agents = skillRuntimeData.agents.map((agent) => ({
      ...agent,
      skills: skillRuntimeData.skills,
      frontmatter: { runtime: "codex-cli" }
    }));

    const skillResult = workspaceValidator.safeDelete(skillRuntimeData, {
      type: "skill",
      id: "typescript",
      label: "TypeScript"
    });
    expect(skillResult.allowed).toBe(false);
    expect(skillResult.references).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "agent", id: "developer", label: "Developer" })
    ]));

    const runtimeResult = workspaceValidator.safeDelete(skillRuntimeData, {
      type: "runtime",
      id: "codex-cli",
      label: "Codex CLI"
    });
    expect(runtimeResult.allowed).toBe(false);
    expect(runtimeResult.references).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "agent", id: "developer", label: "Developer" })
    ]));
  });

  it("reports active operations that reference disabled agents", () => {
    const data = validData();
    data.agents = data.agents.map((agent) => agent.id === "developer" ? { ...agent, enabled: false } : agent);

    const result = workspaceValidator.validate(data);

    expect(result.valid).toBe(false);
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        title: "Disabled agent",
        explanation: "Implement references disabled agent Developer."
      })
    ]));
  });
});
