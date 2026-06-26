import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppData } from "../shared/domain.js";
import type { ContractDefinition } from "../shared/contracts.js";
import type { AgentOperation } from "../shared/operations.js";
import { FlowComposer, type FlowComposerResult, type FlowCreateDraft } from "../flow-composer.js";
import { loadMarkdownAppData, writeEntityMarkdownBatch } from "../markdown-adapter.js";
import { workspaceValidator } from "../workspace-validator.js";
import { MarkdownStore } from "../store.js";

const at = "2026-06-25T08:00:00.000Z";
const tempRoots: string[] = [];

const tempRoot = async () => {
  const root = await mkdtemp(path.join(tmpdir(), "ballet-flow-"));
  tempRoots.push(root);
  return root;
};

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const baseData = (): AppData => ({
  projects: [],
  goals: [],
  adrs: [],
  agents: [{
    id: "developer",
    name: "Developer",
    description: "Builds changes.",
    instructions: "Build the requested change.",
    skills: [],
    enabled: true,
    status: "offline",
    createdAt: at,
    updatedAt: at
  }],
  skills: [],
  runtimes: [],
  contracts: [],
  operations: [],
  policies: [],
  emissionPolicies: [],
  loopDefinitions: [],
  loopInstances: [],
  eventDefinitions: [],
  events: [],
  agentRuns: []
});

const draft = (overrides: Partial<FlowCreateDraft> = {}): FlowCreateDraft => ({
  name: "Customer onboarding",
  purpose: "Prepare a customer account for launch.",
  description: "Onboards a customer after the launch plan is approved.",
  trigger: {
    name: "Launch plan approved",
    description: "A launch plan is ready for customer onboarding.",
    fields: [
      { name: "subject", label: "Customer", type: "text", required: true, example: "acme" },
      { name: "goal", label: "Goal", type: "text", required: true, example: "Launch Acme" }
    ],
    example: { subject: "acme", goal: "Launch Acme" }
  },
  agentTask: {
    agentId: "developer",
    name: "Prepare account",
    instructions: "Prepare the customer account for launch.",
    inputFields: [
      { name: "subject", type: "text", required: true },
      { name: "goal", type: "text", required: true }
    ],
    resultFields: [
      { name: "decision", type: "text", required: false }
    ]
  },
  resultEvent: {
    name: "Customer onboarding completed",
    description: "The customer account is ready.",
    fields: [
      { name: "summary", type: "text", required: true }
    ]
  },
  active: false,
  ...overrides
});

const mergeResult = (data: AppData, result: FlowComposerResult): AppData => ({
  ...data,
  contracts: [...data.contracts, ...result.resources.contracts],
  eventDefinitions: [...data.eventDefinitions, ...result.resources.eventDefinitions],
  operations: [...data.operations, ...result.resources.operations],
  policies: [...data.policies, ...result.resources.routingPolicies],
  emissionPolicies: [...data.emissionPolicies, ...result.resources.emissionPolicies],
  loopDefinitions: [...data.loopDefinitions, ...result.resources.loopDefinitions]
});

const writeFixtureProject = async (root: string) => {
  await mkdir(path.join(root, ".ballet"), { recursive: true });
  await mkdir(path.join(root, ".codex/agents"), { recursive: true });
  await writeFile(path.join(root, ".ballet/project.md"), "---\nid: fixture\nname: Fixture\n---\n\nFixture project.", "utf8");
  await writeFile(path.join(root, ".codex/agents/developer.toml"), `name = "Developer"
description = "Builds changes."
developer_instructions = "Build the requested change."
enabled = true
status = "offline"
`, "utf8");
};

const entriesFromResult = (result: FlowComposerResult) => [
  ...result.resources.contracts.map((item) => ({ collection: "contracts" as const, item: item as unknown as Record<string, unknown> })),
  ...result.resources.eventDefinitions.map((item) => ({ collection: "eventDefinitions" as const, item: item as unknown as Record<string, unknown> })),
  ...result.resources.operations.map((item) => ({ collection: "operations" as const, item: item as unknown as Record<string, unknown> })),
  ...result.resources.routingPolicies.map((item) => ({ collection: "policies" as const, item: item as unknown as Record<string, unknown> })),
  ...result.resources.emissionPolicies.map((item) => ({ collection: "emissionPolicies" as const, item: item as unknown as Record<string, unknown> })),
  ...result.resources.loopDefinitions.map((item) => ({ collection: "loopDefinitions" as const, item: item as unknown as Record<string, unknown> }))
];

const contract = (id: string, version: number, schema: Record<string, unknown>): ContractDefinition => ({
  id,
  version,
  name: `${id} v${version}`,
  description: `${id} v${version}`,
  kind: "event-data",
  active: true,
  schema,
  examples: [],
  createdAt: at,
  updatedAt: at
});

const operationContract = (
  id: string,
  kind: "agent-input" | "agent-output",
  schema: Record<string, unknown>
): ContractDefinition => ({
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

const operationVersion = (version: number): AgentOperation => ({
  id: "developer/published-task",
  version,
  name: `Published task v${version}`,
  description: `Published task v${version}.`,
  active: true,
  agentId: "developer",
  instructions: `Follow instructions v${version}.`,
  inputContract: { id: "published-task-input", version: 1 },
  outputContract: { id: "published-task-output", version: 1 },
  emissionRequired: false,
  createdAt: at,
  updatedAt: at
});

describe("FlowComposer", () => {
  it("creates a complete Flow draft with contracts, events, operation, routing, emission, and loop membership", () => {
    const result = new FlowComposer().compose(baseData(), draft());

    expect(result.validation.valid).toBe(true);
    expect(result.flow).toMatchObject({ id: "customer-onboarding", health: "ready" });
    expect(result.resources.contracts.map((item) => item.kind).sort()).toEqual(["agent-input", "agent-output", "event-data", "event-data"]);
    expect(result.resources.eventDefinitions).toHaveLength(2);
    expect(result.resources.operations[0]).toMatchObject({
      id: "developer/customer-onboarding",
      inputContract: { id: "customer-onboarding-task-input", version: 1 },
      outputContract: { id: "customer-onboarding-task-output", version: 1 }
    });
    expect(result.resources.routingPolicies[0]).toMatchObject({
      consumes: { eventType: "customer-onboarding.started.v1" },
      dispatch: { operation: { id: "developer/customer-onboarding", version: 1 } }
    });
    expect(result.resources.emissionPolicies[0]?.emissions[0]).toMatchObject({
      slot: "completed",
      eventType: "customer-onboarding.completed.v1",
      subject: { from: "/input/subject", default: "customer-onboarding" }
    });
    expect(result.resources.emissionPolicies[0]).toMatchObject({
      gates: [{ type: "required_value", path: "/output/summary" }],
      onGateFailure: "fail_run"
    });
    expect(result.resources.loopDefinitions[0]).toMatchObject({
      id: "customer-onboarding",
      routingPolicyIds: [result.resources.routingPolicies[0]?.id],
      emissionPolicyIds: [result.resources.emissionPolicies[0]?.id]
    });
    expect(result.test).toMatchObject({
      matched: true,
      trigger: {
        name: "Launch plan approved",
        summary: "The trigger example can route into the Flow.",
        exampleData: { subject: "acme", goal: "Launch Acme" }
      },
      operationInputs: [expect.objectContaining({
        taskName: "Prepare account",
        status: "routed",
        input: { subject: "acme", goal: "Launch Acme" }
      })],
      exampleOutputs: [expect.objectContaining({
        taskName: "Prepare account",
        status: "completed"
      })],
      resultBranches: [expect.objectContaining({
        taskName: "Prepare account",
        branchName: "Completed",
        matched: true,
        gateSummary: "Required value passed"
      })],
      emittedEvents: [expect.objectContaining({
        name: "Customer onboarding completed",
        subject: "acme"
      })],
      diagnostics: []
    });
  });

  it("uses visual result-branch settings when generating emission policies", () => {
    const result = new FlowComposer().compose(baseData(), draft({
      resultEvent: {
        name: "Customer onboarding completed",
        description: "The customer account is ready.",
        subjectField: "goal",
        requireSummaryGate: false,
        onGateFailure: "skip",
        fields: [
          { name: "summary", type: "text", required: true }
        ]
      }
    }));

    expect(result.validation.valid).toBe(true);
    expect(result.resources.emissionPolicies[0]).toMatchObject({
      gates: [],
      onGateFailure: "skip"
    });
    expect(result.resources.emissionPolicies[0]?.emissions[0]).toMatchObject({
      subject: { from: "/input/goal", default: "customer-onboarding" },
      dedupeKey: { template: expect.stringContaining("emit-customer-onboarding-completed") }
    });
  });

  it("references selected trigger events and task versions without rewriting them", () => {
    const triggerData = contract("existing-trigger-data", 1, {
      type: "object",
      additionalProperties: false,
      required: ["customerId", "launchTier"],
      properties: {
        customerId: { type: "string" },
        launchTier: { type: "string" }
      }
    });
    const input = operationContract("existing-input", "agent-input", {
      type: "object",
      additionalProperties: false,
      required: ["customerId", "launchTier"],
      properties: {
        customerId: { type: "string" },
        launchTier: { type: "string" }
      }
    });
    const output = operationContract("existing-output", "agent-output", {
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
    const existingOperation: AgentOperation = {
      id: "developer/existing-task",
      version: 2,
      name: "Existing implementation task",
      description: "Existing operation.",
      active: true,
      agentId: "developer",
      instructions: "Use the existing operation.",
      inputContract: { id: input.id, version: input.version },
      outputContract: { id: output.id, version: output.version },
      emissionRequired: true,
      createdAt: at,
      updatedAt: at
    };
    const data: AppData = {
      ...baseData(),
      contracts: [triggerData, input, output],
      operations: [
        { ...existingOperation, version: 1, name: "Older implementation task" },
        existingOperation
      ],
      eventDefinitions: [{
        id: "existing-trigger",
        name: "Existing trigger",
        description: "Existing trigger.",
        active: true,
        eventType: "existing.trigger.v1",
        source: "agentd",
        tags: [],
        dataContract: { id: triggerData.id, version: triggerData.version },
        examples: [{ customerId: "acme", launchTier: "enterprise" }],
        createdAt: at,
        updatedAt: at
      }]
    };

    const result = new FlowComposer().compose(data, draft({
      trigger: { eventId: "existing-trigger", name: "Existing trigger" },
      agentTask: { operationId: existingOperation.id },
      resultEvent: {
        name: "Existing task completed",
        description: "The existing task finished.",
        subjectField: "customerId",
        fields: [{ name: "summary", type: "text", required: true }]
      }
    }));

    expect(result.validation.valid).toBe(true);
    expect(result.resources.contracts.map((item) => item.id)).toEqual(["customer-onboarding-result-data"]);
    expect(result.resources.eventDefinitions.map((item) => item.id)).toEqual(["customer-onboarding-completed-v1"]);
    expect(result.resources.operations).toEqual([]);
    expect(result.resources.routingPolicies[0]).toMatchObject({
      consumes: { eventType: "existing.trigger.v1" },
      dispatch: { operation: { id: existingOperation.id, version: existingOperation.version } },
      input: {
        object: {
          customerId: { from: "/event/data/customerId" },
          launchTier: { from: "/event/data/launchTier" }
        }
      }
    });
    expect(result.resources.emissionPolicies[0]?.observes.operation).toEqual({
      id: existingOperation.id,
      version: existingOperation.version
    });
    expect(result.flow?.entryEvents[0]).toMatchObject({
      id: "event:existing.trigger.v1",
      eventType: "existing.trigger.v1",
      name: "Existing trigger"
    });
    expect(result.test?.operationInputs[0]).toMatchObject({
      taskName: "Existing implementation task",
      status: "routed",
      input: { customerId: "acme", launchTier: "enterprise" }
    });
  });

  it("references a selected result event without generating duplicate event resources", () => {
    const resultData = contract("existing-result-data", 1, {
      type: "object",
      additionalProperties: false,
      required: ["summary", "decision"],
      properties: {
        summary: { type: "string" },
        decision: { type: "string" }
      }
    });
    const data: AppData = {
      ...baseData(),
      contracts: [resultData],
      eventDefinitions: [{
        id: "existing-result",
        name: "Existing result",
        description: "An existing business outcome.",
        active: true,
        eventType: "existing.result.v1",
        source: "agentd",
        tags: [],
        dataContract: { id: resultData.id, version: resultData.version },
        examples: [{ summary: "Account prepared", decision: "approved" }],
        createdAt: at,
        updatedAt: at
      }]
    };

    const result = new FlowComposer().compose(data, draft({
      resultEvent: {
        eventId: "existing-result",
        subjectField: "subject"
      }
    }));

    expect(result.validation.valid).toBe(true);
    expect(result.resources.contracts.map((item) => item.id)).not.toContain("customer-onboarding-result-data");
    expect(result.resources.eventDefinitions.map((item) => item.id)).not.toContain("existing-result");
    expect(result.resources.emissionPolicies[0]?.emissions[0]).toMatchObject({
      eventType: "existing.result.v1",
      data: {
        object: {
          summary: { from: "/output/summary" },
          decision: { from: "/output/result/decision" }
        }
      }
    });
    expect(result.flow?.terminalEvents[0]).toMatchObject({
      eventType: "existing.result.v1",
      name: "Existing result"
    });
  });

  it("uses visual safety-limit settings and creates a limit-exceeded event", () => {
    const result = new FlowComposer().compose(baseData(), draft({
      safetyLimits: {
        maxHops: 7,
        maxRuns: 4,
        maxIterationsPerStep: 2,
        deadlineSeconds: 7200
      },
      limitExceeded: {
        enabled: true,
        name: "Customer onboarding aborted",
        description: "Customer onboarding stopped before completion."
      }
    }));

    expect(result.validation.valid).toBe(true);
    expect(result.resources.contracts.find((item) => item.id === "customer-onboarding-limit-exceeded-data")).toMatchObject({
      kind: "event-data",
      schema: expect.objectContaining({
        required: ["reason"],
        properties: expect.objectContaining({
          reason: expect.objectContaining({ type: "string" })
        })
      }),
      examples: [{ reason: "Maximum steps exceeded." }]
    });
    expect(result.resources.eventDefinitions.find((item) => item.id === "customer-onboarding-limit-exceeded-v1")).toMatchObject({
      name: "Customer onboarding aborted",
      eventType: "customer-onboarding.limit-exceeded.v1",
      source: "agentd",
      dataContract: { id: "customer-onboarding-limit-exceeded-data", version: 1 }
    });
    expect(result.resources.loopDefinitions[0]).toMatchObject({
      limits: {
        maxHops: 7,
        maxRuns: 4,
        maxIterationsPerStep: 2,
        deadlineSeconds: 7200
      },
      onLimitExceeded: { eventType: "customer-onboarding.limit-exceeded.v1" }
    });
    expect(result.flow?.safetyLimits).toEqual({
      maxHops: 7,
      maxRuns: 4,
      maxIterationsPerStep: 2,
      deadlineSeconds: 7200
    });
  });

  it("creates a multi-step Flow with chained routing and emission policies", () => {
    const result = new FlowComposer().compose(baseData(), draft({
      resultEvent: {
        name: "Customer account prepared",
        description: "The customer account is ready for verification.",
        fields: [
          { name: "summary", type: "text", required: true }
        ]
      },
      followUpTasks: [{
        agentId: "developer",
        name: "Verify launch readiness",
        instructions: "Verify the prepared account and publish the final launch decision.",
        inputFields: [
          { name: "summary", type: "text", required: true }
        ],
        resultFields: [
          { name: "decision", type: "text", required: true }
        ],
        inputMapping: {
          object: {
            summary: { from: "/event/data/summary" }
          }
        },
        resultEvent: {
          name: "Customer onboarding completed",
          description: "The customer account has passed verification.",
          fields: [
            { name: "summary", type: "text", required: true },
            { name: "decision", type: "text", required: true }
          ]
        }
      }]
    }));

    expect(result.validation.valid).toBe(true);
    expect(result.resources.operations.map((operation) => operation.name)).toEqual([
      "Prepare account",
      "Verify launch readiness"
    ]);
    expect(result.resources.routingPolicies.map((policy) => policy.consumes.eventType)).toEqual([
      "customer-onboarding.started.v1",
      "customer-onboarding.completed.v1"
    ]);
    expect(result.resources.emissionPolicies.map((policy) => policy.emissions[0]?.eventType)).toEqual([
      "customer-onboarding.completed.v1",
      "customer-onboarding.verify-launch-readiness.completed.v1"
    ]);
    expect(result.resources.loopDefinitions[0]).toMatchObject({
      routingPolicyIds: result.resources.routingPolicies.map((policy) => policy.id),
      emissionPolicyIds: result.resources.emissionPolicies.map((policy) => policy.id),
      terminalEventTypes: ["customer-onboarding.verify-launch-readiness.completed.v1"]
    });
    expect(result.flow?.nodes.filter((node) => node.kind === "operation")).toHaveLength(2);
    expect(result.flow?.edges.filter((edge) => edge.kind === "routing")).toHaveLength(2);
    expect(result.flow?.edges.filter((edge) => edge.kind === "emission")).toHaveLength(2);
    expect(result.test?.downstreamTasks).toEqual([expect.objectContaining({
      taskName: "Verify launch readiness",
      summary: "Customer account prepared can continue to Verify launch readiness."
    })]);
    expect(result.test?.trace.map((entry) => entry.title)).toEqual(expect.arrayContaining([
      "Trigger checked",
      "Operation input mapped",
      "Input validated",
      "Example output prepared",
      "Event emitted",
      "Downstream task found",
      "Diagnostics checked"
    ]));
  });

  it("generates valid trigger examples when the draft does not provide one", () => {
    const result = new FlowComposer().compose(baseData(), draft({
      trigger: {
        name: "Launch plan approved",
        description: "A launch plan is ready for customer onboarding.",
        fields: [
          { name: "subject", type: "text", required: true },
          { name: "priority", type: "number", required: true },
          { name: "requirements", type: "text-list" }
        ]
      }
    }));

    expect(result.validation.valid).toBe(true);
    expect(result.resources.contracts.find((item) => item.id === "customer-onboarding-trigger-data")?.examples[0]).toEqual({
      subject: "subject",
      priority: 1,
      requirements: ["Example"]
    });
  });

  it("updates an existing Flow by id without duplicating graph wiring", () => {
    const composer = new FlowComposer();
    const first = composer.compose(baseData(), draft());
    const second = composer.compose(mergeResult(baseData(), first), draft({
      id: "customer-onboarding",
      name: "Customer launch readiness",
      active: true
    }));

    expect(second.validation.valid).toBe(true);
    expect(second.resources.contracts).toHaveLength(0);
    expect(second.resources.loopDefinitions[0]).toMatchObject({
      id: "customer-onboarding",
      name: "Customer launch readiness",
      active: true
    });
    expect(second.flow?.id).toBe("customer-onboarding");
    expect(second.flow?.edges.filter((edge) => edge.kind === "routing")).toHaveLength(1);
    expect(second.flow?.edges.filter((edge) => edge.kind === "emission")).toHaveLength(1);
  });

  it("creates next operation and contract versions when editing generated Flow task fields", () => {
    const composer = new FlowComposer();
    const first = composer.compose(baseData(), draft());
    const second = composer.compose(mergeResult(baseData(), first), draft({
      id: "customer-onboarding",
      agentTask: {
        agentId: "developer",
        name: "Prepare premium account",
        instructions: "Prepare the premium account and note launch risk.",
        inputFields: [
          { name: "subject", type: "text", required: true },
          { name: "goal", type: "text", required: true },
          { name: "tier", type: "text", required: false }
        ],
        resultFields: [
          { name: "decision", type: "text", required: false },
          { name: "launchRisk", type: "text", required: false }
        ]
      }
    }));

    expect(second.validation.valid).toBe(true);
    expect(second.resources.contracts).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "customer-onboarding-task-input", version: 2 }),
      expect.objectContaining({ id: "customer-onboarding-task-output", version: 2 })
    ]));
    expect(second.resources.operations).toEqual([expect.objectContaining({
      id: "developer/customer-onboarding",
      version: 2,
      name: "Prepare premium account",
      inputContract: { id: "customer-onboarding-task-input", version: 2 },
      outputContract: { id: "customer-onboarding-task-output", version: 2 }
    })]);
    expect(second.resources.routingPolicies[0]).toMatchObject({
      dispatch: { operation: { id: "developer/customer-onboarding", version: 2 } }
    });
    expect(second.resources.emissionPolicies[0]).toMatchObject({
      observes: { operation: { id: "developer/customer-onboarding", version: 2 } }
    });
    expect(second.flow?.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "operation", operationId: "developer/customer-onboarding", version: 2 })
    ]));
  });

  it("writes generated resources as versioned files and reloads a valid workspace without overwriting unrelated files", async () => {
    const root = await tempRoot();
    await writeFixtureProject(root);
    const result = new FlowComposer().compose(baseData(), draft());
    const unrelated = contract("unrelated", 1, { type: "object", additionalProperties: true });
    await writeEntityMarkdownBatch(root, [{ collection: "contracts", item: unrelated as unknown as Record<string, unknown> }]);
    const unrelatedPath = path.join(root, ".ballet/contracts/unrelated.v1.md");
    const before = await readFile(unrelatedPath, "utf8");

    await writeEntityMarkdownBatch(root, entriesFromResult(result));

    const data = await loadMarkdownAppData(root);
    expect(workspaceValidator.validate(data).valid).toBe(true);
    expect(data.loopDefinitions.map((item) => item.id)).toContain("customer-onboarding");
    expect(data.contracts.some((item) => item.id === "customer-onboarding-task-output" && item.relativePath === ".ballet/contracts/customer-onboarding-task-output.v1.md")).toBe(true);
    expect(await readFile(unrelatedPath, "utf8")).toBe(before);
  });

  it("activates and pauses a Flow by updating included routing and emission policies atomically", async () => {
    const root = await tempRoot();
    await writeFixtureProject(root);
    vi.stubEnv("BALLET_PROJECT_ROOT", root);
    vi.stubEnv("BALLET_DB_PATH", path.join(root, "runtime.sqlite"));
    const store = new MarkdownStore();

    try {
      await store.saveFlowDraft(draft());
      let data = await loadMarkdownAppData(root);
      let loop = data.loopDefinitions.find((item) => item.id === "customer-onboarding");
      expect(loop).toMatchObject({ active: false });
      expect(data.policies.filter((policy) => loop?.routingPolicyIds.includes(policy.id)).every((policy) => !policy.active)).toBe(true);
      expect(data.emissionPolicies.filter((policy) => loop?.emissionPolicyIds.includes(policy.id)).every((policy) => !policy.active)).toBe(true);

      const activated = await store.setFlowActive("customer-onboarding", true);
      expect(activated).toMatchObject({ id: "customer-onboarding", active: true });
      data = await loadMarkdownAppData(root);
      loop = data.loopDefinitions.find((item) => item.id === "customer-onboarding");
      expect(loop).toMatchObject({ active: true });
      expect(data.policies.filter((policy) => loop?.routingPolicyIds.includes(policy.id)).every((policy) => policy.active)).toBe(true);
      expect(data.emissionPolicies.filter((policy) => loop?.emissionPolicyIds.includes(policy.id)).every((policy) => policy.active)).toBe(true);

      await store.createEvent({
        projectId: "fixture",
        eventType: "customer-onboarding.started.v1",
        source: "test",
        subject: "acme",
        payload: { subject: "acme", goal: "Launch Acme" }
      });
      expect(store.listAgentRuns()).toEqual([expect.objectContaining({
        operationId: "developer/customer-onboarding",
        status: "queued"
      })]);

      const paused = await store.setFlowActive("customer-onboarding", false);
      expect(paused).toMatchObject({ id: "customer-onboarding", active: false });
      data = await loadMarkdownAppData(root);
      loop = data.loopDefinitions.find((item) => item.id === "customer-onboarding");
      expect(loop).toMatchObject({ active: false });
      expect(data.policies.filter((policy) => loop?.routingPolicyIds.includes(policy.id)).every((policy) => !policy.active)).toBe(true);
      expect(data.emissionPolicies.filter((policy) => loop?.emissionPolicyIds.includes(policy.id)).every((policy) => !policy.active)).toBe(true);
    } finally {
      store.runtimeDatabase().close();
    }
  });

  it("activates only one emission rule version when older inactive versions share the Flow membership ID", async () => {
    const root = await tempRoot();
    await writeFixtureProject(root);
    vi.stubEnv("BALLET_PROJECT_ROOT", root);
    vi.stubEnv("BALLET_DB_PATH", path.join(root, "runtime.sqlite"));
    const store = new MarkdownStore();

    try {
      await store.saveFlowDraft(draft());
      let data = await loadMarkdownAppData(root);
      const originalEmission = data.emissionPolicies.find((policy) => policy.id === "emit-customer-onboarding-completed");
      expect(originalEmission).toBeDefined();
      await writeEntityMarkdownBatch(root, [{
        collection: "emissionPolicies",
        item: {
          id: originalEmission!.id,
          version: 2,
          name: "Emit customer onboarding completed v2",
          description: originalEmission!.description,
          active: false,
          observes: originalEmission!.observes,
          when: originalEmission!.when,
          gates: originalEmission!.gates,
          emissions: originalEmission!.emissions,
          onGateFailure: originalEmission!.onGateFailure,
          priority: originalEmission!.priority,
          createdAt: originalEmission!.createdAt,
          updatedAt: originalEmission!.updatedAt
        } as unknown as Record<string, unknown>
      }]);

      data = await loadMarkdownAppData(root);
      expect(data.emissionPolicies
        .filter((policy) => policy.id === "emit-customer-onboarding-completed")
        .map((policy) => ({ version: policy.version, active: policy.active }))
        .sort((left, right) => left.version - right.version)
      ).toEqual([
        { version: 1, active: false },
        { version: 2, active: false }
      ]);

      const activated = await store.setFlowActive("customer-onboarding", true);
      expect(activated).toMatchObject({ id: "customer-onboarding", active: true, health: "ready" });
      data = await loadMarkdownAppData(root);
      expect(data.emissionPolicies
        .filter((policy) => policy.id === "emit-customer-onboarding-completed")
        .map((policy) => ({ version: policy.version, active: policy.active }))
        .sort((left, right) => left.version - right.version)
      ).toEqual([
        { version: 1, active: false },
        { version: 2, active: true }
      ]);

      await store.setFlowActive("customer-onboarding", false);
      data = await loadMarkdownAppData(root);
      expect(data.emissionPolicies
        .filter((policy) => policy.id === "emit-customer-onboarding-completed")
        .every((policy) => !policy.active)
      ).toBe(true);
    } finally {
      store.runtimeDatabase().close();
    }
  });

  it("updates saved Flow settings without duplicating graph wiring", async () => {
    const root = await tempRoot();
    await writeFixtureProject(root);
    vi.stubEnv("BALLET_PROJECT_ROOT", root);
    vi.stubEnv("BALLET_DB_PATH", path.join(root, "runtime.sqlite"));
    const store = new MarkdownStore();

    try {
      await store.saveFlowDraft(draft());
      const updated = await store.updateFlowSettings("customer-onboarding", {
        name: "Customer launch readiness",
        description: "Updated settings through the Flow settings panel.",
        safetyLimits: {
          maxHops: 12,
          maxRuns: 6,
          maxIterationsPerStep: 2,
          deadlineSeconds: 3600
        },
        limitExceeded: {
          enabled: true,
          name: "Customer onboarding aborted",
          description: "Customer onboarding stopped before completion."
        }
      });

      expect(updated).toMatchObject({
        id: "customer-onboarding",
        name: "Customer launch readiness",
        description: "Updated settings through the Flow settings panel.",
        safetyLimits: {
          maxHops: 12,
          maxRuns: 6,
          maxIterationsPerStep: 2,
          deadlineSeconds: 3600
        }
      });
      const data = await loadMarkdownAppData(root);
      const loop = data.loopDefinitions.find((item) => item.id === "customer-onboarding");
      expect(loop).toMatchObject({
        name: "Customer launch readiness",
        routingPolicyIds: ["on-customer-onboarding-started-start-prepare-account"],
        emissionPolicyIds: ["emit-customer-onboarding-completed"],
        onLimitExceeded: { eventType: "customer-onboarding.limit-exceeded.v1" }
      });
      expect(data.contracts.find((item) => item.id === "customer-onboarding-limit-exceeded-data")).toMatchObject({
        kind: "event-data",
        schema: expect.objectContaining({
          required: ["reason"]
        })
      });
      expect(data.eventDefinitions.find((item) => item.eventType === "customer-onboarding.limit-exceeded.v1")).toMatchObject({
        name: "Customer onboarding aborted",
        dataContract: { id: "customer-onboarding-limit-exceeded-data", version: 1 }
      });
      expect(workspaceValidator.validate(data).valid).toBe(true);
    } finally {
      store.runtimeDatabase().close();
    }
  });

  it("tests a saved Flow with a plain-language routing and emission simulation", async () => {
    const root = await tempRoot();
    await writeFixtureProject(root);
    vi.stubEnv("BALLET_PROJECT_ROOT", root);
    vi.stubEnv("BALLET_DB_PATH", path.join(root, "runtime.sqlite"));
    const store = new MarkdownStore();

    try {
      await store.saveFlowDraft(draft({
        resultEvent: {
          name: "Customer account prepared",
          description: "The customer account is ready for verification.",
          fields: [
            { name: "summary", type: "text", required: true }
          ]
        },
        followUpTasks: [{
          agentId: "developer",
          name: "Verify launch readiness",
          instructions: "Verify the prepared account and publish the final launch decision.",
          inputFields: [
            { name: "summary", type: "text", required: true }
          ],
          inputMapping: {
            object: {
              summary: { from: "/event/data/summary" }
            }
          },
          resultEvent: {
            name: "Customer onboarding completed",
            description: "The customer account has passed verification.",
            fields: [
              { name: "summary", type: "text", required: true }
            ]
          }
        }]
      }));

      const result = await store.testFlow("customer-onboarding");

      expect(result.matched).toBe(true);
      expect(result.trace.map((entry) => entry.title)).toEqual(expect.arrayContaining([
        "Trigger checked",
        "Operation input mapped",
        "Input validated",
        "Example output prepared",
        "Result branch matched",
        "Event emitted",
        "Downstream task found",
        "Diagnostics checked"
      ]));
      expect(result.simulation?.trigger.exampleData).toEqual({ subject: "acme", goal: "Launch Acme" });
      expect(result.simulation?.emittedEvents).toEqual(expect.arrayContaining([expect.objectContaining({
        name: "Customer account prepared",
        subject: "acme"
      })]));
      expect(result.simulation?.downstreamTasks).toEqual([expect.objectContaining({
        taskName: "Verify launch readiness"
      })]);
      expect(result.routing).toEqual(expect.arrayContaining([expect.objectContaining({
        taskName: "Prepare account",
        status: "routed",
        input: { subject: "acme", goal: "Launch Acme" }
      })]));
    } finally {
      store.runtimeDatabase().close();
    }
  });

  it("rolls back all touched files when a composite write fails", async () => {
    const root = await tempRoot();
    const result = new FlowComposer().compose(baseData(), draft());

    await expect(writeEntityMarkdownBatch(root, entriesFromResult(result), { failAfterCommits: 1 })).rejects.toThrow("Injected entity batch write failure");

    await expect(stat(path.join(root, ".ballet/contracts/customer-onboarding-trigger-data.v1.md"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(stat(path.join(root, ".ballet/events/customer-onboarding-started-v1.md"))).rejects.toMatchObject({ code: "ENOENT" });
    const stagingEntries = await readdir(path.join(root, ".ballet/.staging")).catch(() => []);
    expect(stagingEntries).toEqual([]);
  });

  it("restores existing canonical files when a later composite write fails", async () => {
    const root = await tempRoot();
    const result = new FlowComposer().compose(baseData(), draft());
    const entries = entriesFromResult(result);
    const firstContractPath = path.join(root, ".ballet/contracts/customer-onboarding-trigger-data.v1.md");
    await writeEntityMarkdownBatch(root, [entries[0]!]);
    const originalSource = await readFile(firstContractPath, "utf8");

    const changedFirstEntry = {
      ...entries[0]!,
      item: {
        ...entries[0]!.item,
        name: "Mutated trigger data"
      }
    };

    await expect(writeEntityMarkdownBatch(root, [
      changedFirstEntry,
      entries[1]!
    ], { failAfterCommits: 1 })).rejects.toThrow("Injected entity batch write failure");

    expect(await readFile(firstContractPath, "utf8")).toBe(originalSource);
    await expect(stat(path.join(root, ".ballet/contracts/customer-onboarding-task-input.v1.md"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("lets multiple versions coexist and rejects in-place published resource mutation through the store", async () => {
    const root = await tempRoot();
    await writeFixtureProject(root);
    await writeEntityMarkdownBatch(root, [
      { collection: "contracts", item: contract("shape", 1, { type: "object", properties: { name: { type: "string" } } }) as unknown as Record<string, unknown> },
      { collection: "contracts", item: contract("shape", 2, { type: "object", properties: { name: { type: "string" }, age: { type: "number" } } }) as unknown as Record<string, unknown> },
      {
        collection: "contracts",
        item: operationContract("published-task-input", "agent-input", {
          type: "object",
          additionalProperties: true
        }) as unknown as Record<string, unknown>
      },
      {
        collection: "contracts",
        item: operationContract("published-task-output", "agent-output", {
          type: "object",
          additionalProperties: false,
          required: ["status", "summary"],
          properties: {
            status: { type: "string", enum: ["completed", "blocked", "needs_input", "failed"] },
            summary: { type: "string" },
            result: { type: "object", additionalProperties: true },
            evidence: { type: "object", additionalProperties: true }
          }
        }) as unknown as Record<string, unknown>
      },
      { collection: "operations", item: operationVersion(1) as unknown as Record<string, unknown> },
      { collection: "operations", item: operationVersion(2) as unknown as Record<string, unknown> }
    ]);

    const data = await loadMarkdownAppData(root);
    expect(data.contracts.filter((item) => item.id === "shape").map((item) => item.version).sort()).toEqual([1, 2]);
    expect(data.operations.filter((item) => item.id === "developer/published-task").map((item) => item.version).sort()).toEqual([1, 2]);
    expect(workspaceValidator.validate(data).valid).toBe(true);

    vi.stubEnv("BALLET_PROJECT_ROOT", root);
    const store = new MarkdownStore();
    try {
      await expect(store.upsert("contracts", {
        id: "shape",
        version: 1,
        name: "shape v1",
        description: "mutated",
        kind: "event-data",
        active: true,
        schema: { type: "object", properties: { changed: { type: "string" } } },
        examples: []
      })).rejects.toThrow("Published data shape versions are immutable");
      await expect(store.upsert("operations", {
        id: "developer/published-task",
        version: 1,
        instructions: "Mutate the published task in place."
      })).rejects.toThrow("Published task versions are immutable");
      await expect(store.upsert("operations", {
        id: "developer/published-task",
        version: 1,
        name: "Renamed published task",
        description: "Retitled published task."
      })).rejects.toThrow("Published task versions are immutable");
    } finally {
      store.runtimeDatabase().close();
    }
  });

  it("blocks direct deactivation of referenced resources through the store", async () => {
    const root = await tempRoot();
    await writeFixtureProject(root);
    const result = new FlowComposer().compose(baseData(), draft({ active: true }));
    await writeEntityMarkdownBatch(root, entriesFromResult(result));

    vi.stubEnv("BALLET_PROJECT_ROOT", root);
    const store = new MarkdownStore();
    try {
      await expect(store.upsert("policies", {
        id: result.resources.routingPolicies[0]!.id,
        active: false
      })).rejects.toThrow("Cannot deactivate");

      await expect(store.upsert("agents", {
        id: "developer",
        enabled: false
      })).rejects.toThrow("Cannot deactivate developer because it is still referenced.");
    } finally {
      store.runtimeDatabase().close();
    }
  });
});
