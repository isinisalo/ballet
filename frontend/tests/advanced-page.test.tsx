// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppData } from "../../backend/shared/domain";
import type { ContractDefinition } from "../../backend/shared/contracts";
import { AdvancedPage } from "../src/features/advanced/AdvancedPage";

const apiMocks = vi.hoisted(() => ({
  checkSafeDelete: vi.fn(),
  save: vi.fn(),
  dryRunRoutingPolicy: vi.fn(),
  dryRunEmissionPolicy: vi.fn()
}));

vi.mock("@/api", () => ({
  api: apiMocks
}));

const at = "2026-06-25T08:00:00.000Z";

const contract = (version: number): ContractDefinition => ({
  id: "plan-approved-data",
  version,
  name: `Plan approved data v${version}`,
  description: "Data captured when a plan is approved.",
  kind: "event-data",
  active: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["goal"],
    properties: {
      goal: { type: "string", description: "Business goal", examples: ["Launch"] },
      priority: { type: "number" }
    }
  },
  examples: [{ goal: "Launch", priority: 1 }],
  createdAt: at,
  updatedAt: at
});

const agentOutputContract: ContractDefinition = {
  id: "implement-output",
  version: 1,
  name: "Implement output",
  description: "Implementation task result.",
  kind: "agent-output",
  active: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["status", "summary"],
    properties: {
      status: { type: "string", enum: ["completed", "blocked", "needs_input", "failed"] },
      summary: { type: "string" },
      result: {
        type: "object",
        additionalProperties: false,
        required: ["decision"],
        properties: {
          decision: { title: "Decision", type: "string", enum: ["Approved", "Changes requested"], examples: ["Approved"] },
          risk: { title: "Risk", type: "number", default: 1 }
        }
      },
      evidence: {
        type: "object",
        additionalProperties: false,
        properties: {
          checks: { title: "Checks", type: "array", items: { type: "object", additionalProperties: true } }
        }
      }
    }
  },
  examples: [{
    status: "completed",
    summary: "Implementation finished.",
    result: { decision: "Approved", risk: 1 },
    evidence: { checks: [{ name: "npm test", status: "passed" }] }
  }],
  createdAt: at,
  updatedAt: at
};

const data: AppData = {
  projects: [],
  goals: [],
  adrs: [],
  agents: [{
    id: "developer-agent",
    name: "Developer",
    description: "Developer.",
    instructions: "Develop.",
    skills: [],
    enabled: true,
    status: "offline",
    createdAt: at,
    updatedAt: at
  }],
  skills: [],
  runtimes: [],
  contracts: [contract(1), contract(2)],
  operations: [{
    id: "developer-agent/implement",
    version: 1,
    name: "Implement plan",
    description: "Implement.",
    active: true,
    agentId: "developer-agent",
    instructions: "Implement.",
    inputContract: { id: "plan-approved-data", version: 1 },
    outputContract: { id: "plan-approved-data", version: 2 },
    emissionRequired: false,
    createdAt: at,
    updatedAt: at
  }],
  policies: [{
    id: "route-plan-approved-to-implement",
    name: "When plan approved, ask Implement plan",
    description: "Routes approved plans to implementation.",
    active: true,
    consumes: { eventType: "plan.approved.v1" },
    when: { path: "/event/data/goal", op: "exists", value: true },
    dispatch: { operation: { id: "developer-agent/implement", version: 1 } },
    input: {
      object: {
        goal: { from: "/event/data/goal" },
        priority: { from: "/event/data/priority", default: 1 }
      }
    },
    selection: { mode: "fanout" },
    onInvalidInput: "reject-event",
    createdAt: at,
    updatedAt: at
  }],
  emissionPolicies: [{
    id: "emit-plan-implemented",
    version: 1,
    name: "Publish plan implemented",
    description: "Publishes the implemented event after the task completes.",
    active: true,
    observes: { operation: { id: "developer-agent/implement", version: 1 } },
    when: { path: "/output/status", op: "eq", value: "completed" },
    gates: [{ type: "required_value", path: "/output/summary" }],
    emissions: [{
      slot: "completed",
      eventType: "plan.implemented.v1",
      subject: { from: "/input/goal" },
      tags: { const: ["delivery"] },
      data: {
        object: {
          goal: { from: "/output/result/goal" },
          priority: { from: "/output/result/priority", default: 1 }
        }
      },
      dedupeKey: { template: "emission:{{/run/id}}:completed" }
    }],
    onGateFailure: "fail_run",
    createdAt: at,
    updatedAt: at
  }],
  loopDefinitions: [{
    id: "delivery-loop",
    version: 1,
    name: "Delivery loop",
    description: "Coordinates implementation.",
    active: true,
    entryEventTypes: ["plan.approved.v1"],
    terminalEventTypes: ["plan.implemented.v1"],
    routingPolicyIds: ["route-plan-approved-to-implement"],
    emissionPolicyIds: ["emit-plan-implemented"],
    limits: {
      maxHops: 10,
      maxRuns: 8,
      maxIterationsPerStep: 2,
      deadlineSeconds: 3600
    },
    onLimitExceeded: { eventType: "plan.implemented.v1" },
    createdAt: at,
    updatedAt: at
  }],
  loopInstances: [],
  eventDefinitions: [
    {
      id: "plan-approved",
      name: "Plan approved",
      description: "Plan approved.",
      active: true,
      eventType: "plan.approved.v1",
      tags: [],
      dataContract: { id: "plan-approved-data", version: 1 },
      examples: [{ goal: "Launch", priority: 1 }],
      createdAt: at,
      updatedAt: at
    },
    {
      id: "plan-implemented",
      name: "Plan implemented",
      description: "Plan implemented.",
      active: true,
      eventType: "plan.implemented.v1",
      tags: ["delivery"],
      dataContract: { id: "plan-approved-data", version: 2 },
      examples: [{ goal: "Launch", priority: 1 }],
      createdAt: at,
      updatedAt: at
    }
  ],
  events: [],
  agentRuns: []
};

beforeEach(() => {
  apiMocks.checkSafeDelete.mockReset();
  apiMocks.save.mockReset();
  apiMocks.dryRunRoutingPolicy.mockReset();
  apiMocks.dryRunEmissionPolicy.mockReset();
  apiMocks.checkSafeDelete.mockResolvedValue({
    allowed: false,
    references: [{ type: "event", id: "plan-approved", label: "Plan approved" }],
    diagnostics: [{
      severity: "error",
      title: "Resource is still in use",
      explanation: "Plan approved data is referenced by Plan approved.",
      resource: { type: "event", id: "plan-approved", label: "Plan approved" },
      suggestedFix: "Remove the reference first."
    }]
  });
  apiMocks.save.mockResolvedValue(contract(3));
  apiMocks.dryRunRoutingPolicy.mockResolvedValue({
    message: "1 routing decision evaluated.",
    decisions: [{
      policyName: "When plan approved, ask Implement plan",
      status: "routed",
      reason: "Input matched and validated."
    }]
  });
  apiMocks.dryRunEmissionPolicy.mockResolvedValue({
    decisions: [{
      emissionPolicyId: "emit-plan-implemented",
      status: "emitted",
      reason: "Emission policy produced events."
    }],
    events: [{ type: "plan.implemented.v1" }]
  });
});

afterEach(() => {
  cleanup();
});

describe("AdvancedPage non-contract resources", () => {
  it("shows event data shapes with incoming and outgoing rule references", () => {
    render(<AdvancedPage data={data} validation={{ valid: true, diagnostics: [] }} advancedRoute="events" />);

    expect(screen.getByRole("heading", { name: "Plan approved" })).toBeVisible();
    expect(screen.getAllByText("Event shape")[0]).toBeVisible();
    expect(screen.getAllByText("Business goal")[0]).toBeVisible();
    expect(screen.getAllByText("Example data")[0]).toBeVisible();
    expect(screen.getAllByText("Event example")[0]).toBeVisible();
    expect(screen.getAllByText("1 event example matches the data shape.")[0]).toBeVisible();
    expect(screen.getAllByText("Launch")[0]).toBeVisible();
    expect(screen.getAllByText("Outgoing routing rules")[0]).toBeVisible();
    expect(screen.getByText("When plan approved, ask Implement plan")).toBeVisible();
    expect(screen.getAllByText("Incoming emission rules")[0]).toBeVisible();
    expect(screen.getAllByText(/Publish plan implemented/)[0]).toBeVisible();
    expect(screen.queryByText("Examples")).not.toBeInTheDocument();
  });

  it("renders routing rules with visual condition and mapping builders plus a dry-run panel", async () => {
    const user = userEvent.setup();
    render(<AdvancedPage data={data} validation={{ valid: true, diagnostics: [] }} advancedRoute="routing" />);

    expect(screen.getByRole("heading", { name: "When plan approved, ask Implement plan" })).toBeVisible();
    expect(screen.getByText("Routing rule")).toBeVisible();
    expect(screen.getByText("Source event")).toBeVisible();
    expect(screen.getByText("Target task")).toBeVisible();
    expect(screen.getByText("Trigger field")).toBeVisible();
    expect(screen.getByText("Input mapping")).toBeVisible();
    expect(screen.getByText("Reject the event")).toBeVisible();
    expect(screen.getByText("Trigger data example")).toBeVisible();
    expect(screen.getByLabelText(/routing test goal/i)).toHaveValue("Launch");
    expect(screen.queryByLabelText("Routing test event data")).not.toBeInTheDocument();

    const routingPriority = screen.getByLabelText(/routing test priority/i);
    await user.clear(routingPriority);
    await user.type(routingPriority, "2");

    await user.click(screen.getByRole("button", { name: /^test routing rule$/i }));

    expect(apiMocks.dryRunRoutingPolicy).toHaveBeenCalledWith("route-plan-approved-to-implement", expect.objectContaining({
      eventType: "plan.approved.v1",
      subject: "dry-run-subject",
      payload: { goal: "Launch", priority: 2 }
    }));
    expect(await screen.findByText("1 routing decision evaluated.")).toBeVisible();
  });

  it("renders emission rules with result conditions, gates, event mappings, and dry-run testing", async () => {
    const user = userEvent.setup();
    render(<AdvancedPage data={data} validation={{ valid: true, diagnostics: [] }} advancedRoute="emissions" />);

    expect(screen.getByRole("heading", { name: "Publish plan implemented" })).toBeVisible();
    expect(screen.getByText("Emission rule")).toBeVisible();
    expect(screen.getByText("Observed task")).toBeVisible();
    expect(screen.getByText("Result condition")).toBeVisible();
    expect(screen.getByText("Technical gates")).toBeVisible();
    expect(screen.getByText("Require a value at /output/summary")).toBeVisible();
    expect(screen.getByText("Event data mapping for Plan implemented")).toBeVisible();
    expect(screen.getByText("Operation input example")).toBeVisible();
    expect(screen.getByText("Operation output example")).toBeVisible();
    expect(screen.getByText("Operation result example")).toBeVisible();
    expect(screen.getByLabelText(/operation input goal/i)).toHaveValue("Launch");
    expect(screen.getByLabelText(/operation output status/i)).toHaveValue("completed");
    expect(screen.queryByLabelText("Emission test operation input")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Emission test operation output")).not.toBeInTheDocument();

    const resultPriority = screen.getByLabelText(/operation result priority/i);
    await user.clear(resultPriority);
    await user.type(resultPriority, "3");

    await user.click(screen.getByRole("button", { name: /^test emission rule$/i }));

    expect(apiMocks.dryRunEmissionPolicy).toHaveBeenCalledWith("emit-plan-implemented", expect.objectContaining({
      operationInput: expect.objectContaining({ goal: "Launch" }),
      operationOutput: expect.objectContaining({
        status: "completed",
        summary: expect.any(String),
        result: expect.objectContaining({ priority: 3 })
      })
    }));
    expect(await screen.findByText("1 event emitted.")).toBeVisible();
    expect(screen.getByText("plan.implemented.v1")).toBeVisible();
  });

  it("renders loop definitions as Flow boundaries with included steps and safety limits", () => {
    render(<AdvancedPage data={data} validation={{ valid: true, diagnostics: [] }} advancedRoute="loops" />);

    expect(screen.getByRole("heading", { name: "Delivery loop" })).toBeVisible();
    expect(screen.getByText("Flow definition")).toBeVisible();
    expect(screen.getByText("When")).toBeVisible();
    expect(screen.getByText("Ask")).toBeVisible();
    expect(screen.getByText("Publish or stop at")).toBeVisible();
    expect(screen.getAllByText("Plan approved")[0]).toBeVisible();
    expect(screen.getAllByText("Implement plan")[0]).toBeVisible();
    expect(screen.getAllByText("Plan implemented")[0]).toBeVisible();
    expect(screen.getByText("Maximum agent runs")).toBeVisible();
    expect(screen.getByText("3600 seconds")).toBeVisible();
  });

  it("checks skill and runtime delete safety with their own resource types", async () => {
    const user = userEvent.setup();
    const dataWithSkillAndRuntime: AppData = {
      ...data,
      skills: [{ id: "typescript", name: "TypeScript", description: "TypeScript work.", metadata: {}, enabled: true }],
      runtimes: [{
        id: "codex-cli",
        name: "Codex CLI",
        type: "codex-cli",
        command: "codex",
        config: {},
        enabled: true,
        createdAt: at,
        updatedAt: at
      }],
      agents: data.agents.map((agent) => ({
        ...agent,
        skills: [{ id: "typescript", name: "TypeScript", description: "TypeScript work.", metadata: {}, enabled: true }],
        frontmatter: { runtime: "codex-cli" }
      }))
    };
    apiMocks.checkSafeDelete.mockResolvedValue({
      allowed: false,
      references: [{ type: "agent", id: "developer-agent", label: "Developer" }],
      diagnostics: []
    });

    const skillsView = render(<AdvancedPage data={dataWithSkillAndRuntime} validation={{ valid: true, diagnostics: [] }} advancedRoute="skills" />);
    expect(screen.getByRole("heading", { name: "TypeScript" })).toBeVisible();
    expect(screen.getByText("Developer")).toBeVisible();
    await user.click(screen.getByRole("button", { name: /check delete safety/i }));
    expect(apiMocks.checkSafeDelete).toHaveBeenLastCalledWith({
      type: "skill",
      id: "typescript",
      label: "TypeScript"
    });
    skillsView.unmount();

    render(<AdvancedPage data={dataWithSkillAndRuntime} validation={{ valid: true, diagnostics: [] }} advancedRoute="runtimes" />);
    expect(screen.getByRole("heading", { name: "Codex CLI" })).toBeVisible();
    expect(screen.getByText("Developer")).toBeVisible();
    await user.click(screen.getByRole("button", { name: /check delete safety/i }));
    expect(apiMocks.checkSafeDelete).toHaveBeenLastCalledWith({
      type: "runtime",
      id: "codex-cli",
      label: "Codex CLI"
    });
  });
});

describe("AdvancedPage data types", () => {
  it("shows versioned resources, safe-delete feedback, hidden source, and visual next-version creation", async () => {
    const user = userEvent.setup();
    const refresh = vi.fn().mockResolvedValue(undefined);
    render(<AdvancedPage data={data} validation={{ valid: true, diagnostics: [] }} advancedRoute="contracts" refresh={refresh} />);

    expect(screen.getByRole("heading", { name: "Plan approved data v1" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Plan approved data v2" })).toBeVisible();
    expect(screen.getAllByText("v1")[0]).toBeVisible();
    expect(screen.getAllByText("v2")[0]).toBeVisible();
    expect(screen.getAllByText(/Implement plan/)[0]).toBeVisible();
    expect(screen.getAllByText(/Plan approved/)[0]).toBeVisible();
    expect(screen.getAllByText("Data shape")[0]).toBeVisible();
    expect(screen.getAllByText("Fields")[0]).toBeVisible();
    expect(screen.getAllByText("Business goal")[0]).toBeVisible();
    expect(screen.getAllByText("Schema preview")[0]).toBeVisible();
    expect(screen.getAllByText("Additional fields")[0]).toBeVisible();
    expect(screen.getAllByText("Blocked")[0]).toBeVisible();
    expect(screen.getAllByText("Example validation")[0]).toBeVisible();
    expect(screen.getAllByText("1 example matches this data shape.")[0]).toBeVisible();

    const sourceSummary = screen.getAllByText("Advanced source")[0]!;
    const sourceDetails = sourceSummary.closest("details");
    expect(sourceDetails).not.toHaveAttribute("open");
    expect(within(sourceDetails!).getByText(/plan-approved-data/)).not.toBeVisible();

    await user.click(screen.getAllByRole("button", { name: /check delete safety/i })[0]!);
    expect(await screen.findByText("Plan approved data v1 cannot be deleted yet")).toBeVisible();
    expect(screen.getByText(/Referenced by Plan approved/)).toBeVisible();
    expect(apiMocks.checkSafeDelete).toHaveBeenCalledWith({
      type: "contract",
      id: "plan-approved-data",
      version: 1,
      label: "Plan approved data v1"
    });

    await user.click(screen.getAllByRole("button", { name: /create next version/i })[0]!);
    expect(screen.getByText("Create version 3")).toBeVisible();
    await user.clear(screen.getByLabelText("Data type name"));
    await user.type(screen.getByLabelText("Data type name"), "Plan approved data v3");
    await user.click(screen.getByRole("button", { name: /save next version/i }));

    expect(apiMocks.save).toHaveBeenCalledWith("contracts", expect.objectContaining({
      id: "plan-approved-data",
      version: 3,
      name: "Plan approved data v3",
      schema: expect.objectContaining({
        properties: expect.objectContaining({
          goal: expect.objectContaining({ type: "string" }),
          priority: expect.objectContaining({ type: "number" })
        })
      }),
      examples: [expect.objectContaining({ goal: "Launch", priority: 1 })]
    }));
    expect(refresh).toHaveBeenCalled();
  });

  it("protects the agent-output envelope when creating a next contract version", async () => {
    const user = userEvent.setup();
    const refresh = vi.fn().mockResolvedValue(undefined);
    apiMocks.save.mockResolvedValue({ ...agentOutputContract, version: 2 });

    render(
      <AdvancedPage
        data={{ ...data, contracts: [agentOutputContract] }}
        validation={{ valid: true, diagnostics: [] }}
        advancedRoute="contracts"
        refresh={refresh}
      />
    );

    await user.click(screen.getByRole("button", { name: /create next version/i }));

    expect(screen.getByText("Create version 2")).toBeVisible();
    expect(screen.getAllByText("Protected output envelope")[0]).toBeVisible();
    expect(screen.getAllByText("Result fields")[0]).toBeVisible();
    expect(screen.getAllByText("Evidence fields")[0]).toBeVisible();
    expect(screen.queryByDisplayValue("status")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("summary")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /save next version/i }));

    expect(apiMocks.save).toHaveBeenCalledWith("contracts", expect.objectContaining({
      id: "implement-output",
      version: 2,
      kind: "agent-output",
      schema: expect.objectContaining({
        required: ["status", "summary"],
        properties: expect.objectContaining({
          status: expect.objectContaining({ type: "string", enum: ["completed", "blocked", "needs_input", "failed"] }),
          summary: expect.objectContaining({ type: "string" }),
          result: expect.objectContaining({
            properties: expect.objectContaining({
              decision: expect.objectContaining({ type: "string", enum: ["Approved", "Changes requested"] }),
              risk: expect.objectContaining({ type: "number", default: 1 })
            })
          }),
          evidence: expect.objectContaining({
            properties: expect.objectContaining({
              checks: expect.objectContaining({ type: "array" })
            })
          })
        })
      }),
      examples: [expect.objectContaining({
        status: "completed",
        summary: "Dry-run completed",
        result: expect.objectContaining({ decision: "Approved", risk: 1 }),
        evidence: expect.objectContaining({
          checks: [{ name: "example", status: "passed" }]
        })
      })]
    }));
    expect(refresh).toHaveBeenCalled();
  });
});
