// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppData } from "../../backend/shared/domain";
import type { ContractDefinition } from "../../backend/shared/contracts";
import { TopBar } from "../src/app/TopBar";
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
  it("shows the compact theme selector in the top bar", async () => {
    const user = userEvent.setup();
    const onThemeModeChange = vi.fn();

    render(<TopBar data={data} themeMode="dark" onThemeModeChange={onThemeModeChange} />);

    expect(screen.getByRole("button", { name: /dark/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /light/i })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /system/i })).toHaveAttribute("aria-pressed", "false");

    await user.click(screen.getByRole("button", { name: /system/i }));
    expect(onThemeModeChange).toHaveBeenCalledWith("system");
  });

  it("shows the selected event data shape with incoming or outgoing rule references", () => {
    render(<AdvancedPage data={data} validation={{ valid: true, diagnostics: [] }} advancedRoute="events" selectedKey="plan-implemented" />);

    expect(screen.getByRole("button", { name: /Plan implemented/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /Plan approved/ })).toBeVisible();
    expect(screen.getAllByText("Event shape")[0]).toBeVisible();
    expect(screen.getAllByText("Business goal")[0]).toBeVisible();
    expect(screen.getAllByText("Example data")[0]).toBeVisible();
    expect(screen.getAllByText("Event example")[0]).toBeVisible();
    expect(screen.getAllByText("1 event example matches the data shape.")[0]).toBeVisible();
    expect(screen.getAllByText("Launch")[0]).toBeVisible();
    expect(screen.getAllByText("Incoming emission rules")[0]).toBeVisible();
    expect(screen.getAllByText(/Publish plan implemented/)[0]).toBeVisible();
    expect(screen.getAllByText("Outgoing routing rules")[0]).toBeVisible();
    expect(screen.getAllByText("No routing rules start from this event.")[0]).toBeVisible();
    expect(screen.queryByText("Examples")).not.toBeInTheDocument();
  });

  it("saves a routing rule from only the description, input event, and agent fields", async () => {
    const user = userEvent.setup();
    const refresh = vi.fn().mockResolvedValue(undefined);
    render(<AdvancedPage data={data} validation={{ valid: true, diagnostics: [] }} advancedRoute="routing" refresh={refresh} />);

    expect(screen.getByRole("button", { name: /Plan approved -> Developer/ })).toBeVisible();
    expect(screen.getByLabelText("Description")).toBeVisible();
    expect(screen.getByLabelText("Input event")).toHaveValue("plan.approved.v1");
    expect(screen.getByLabelText("Agent")).toHaveValue("developer-agent");
    expect(screen.getByRole("button", { name: /^save routing rule$/i })).toBeVisible();
    expect(screen.queryByLabelText("Send to agent task")).not.toBeInTheDocument();
    expect(screen.queryByText("Advanced details")).not.toBeInTheDocument();
    expect(screen.queryByText("Resource details")).not.toBeInTheDocument();
    expect(screen.queryByText("Advanced source")).not.toBeInTheDocument();
    expect(screen.queryByText("Check delete safety")).not.toBeInTheDocument();
    expect(screen.queryByText("Agent input preview")).not.toBeInTheDocument();
    expect(screen.queryByText("Enabled")).not.toBeInTheDocument();
    expect(screen.queryByText("Technical identity")).not.toBeInTheDocument();
    expect(screen.queryByText("Uses")).not.toBeInTheDocument();
    expect(screen.queryByText("Used by")).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText("Description"));
    await user.type(screen.getByLabelText("Description"), "Start implementation when the plan is approved.");
    await user.click(screen.getByRole("button", { name: /^save routing rule$/i }));

    expect(apiMocks.save).toHaveBeenCalledWith("policies", expect.objectContaining({
      consumes: { eventType: "plan.approved.v1" },
      dispatch: { operation: { id: "developer-agent/implement", version: 1 } },
      description: "Start implementation when the plan is approved.",
      input: { object: {
        goal: { from: "/event/data/goal" },
        priority: { from: "/event/data/priority" }
      } },
      selection: { mode: "fanout" },
      onInvalidInput: "reject-event"
    }));
    expect(refresh).toHaveBeenCalled();
  });

  it("selects routing rules from the in-page resource list", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    const secondRouteData: AppData = {
      ...data,
      agents: [
        ...data.agents,
        {
          id: "security-agent",
          name: "Security",
          description: "Security response.",
          instructions: "Investigate security events.",
          skills: [],
          enabled: true,
          status: "offline",
          createdAt: at,
          updatedAt: at
        }
      ],
      operations: [
        ...data.operations,
        {
          id: "security-agent/investigate",
          version: 1,
          name: "Investigate incident",
          description: "Investigate.",
          active: true,
          agentId: "security-agent",
          instructions: "Investigate.",
          inputContract: { id: "plan-approved-data", version: 1 },
          outputContract: { id: "plan-approved-data", version: 2 },
          emissionRequired: false,
          createdAt: at,
          updatedAt: at
        }
      ],
      policies: [
        ...data.policies,
        {
          id: "route-security-incident",
          name: "Plan implemented -> Security",
          description: "Routes security incidents to investigation.",
          active: true,
          consumes: { eventType: "plan.implemented.v1" },
          dispatch: { operation: { id: "security-agent/investigate", version: 1 } },
          input: { object: { goal: { from: "/event/data/goal" } } },
          selection: { mode: "fanout" },
          onInvalidInput: "reject-event",
          createdAt: at,
          updatedAt: at
        }
      ]
    };

    const { rerender } = render(
      <AdvancedPage
        data={secondRouteData}
        validation={{ valid: true, diagnostics: [] }}
        advancedRoute="routing"
        selectedKey="route-plan-approved-to-implement"
        navigate={navigate}
      />
    );

    expect(screen.getByLabelText("Agent")).toHaveValue("developer-agent");
    expect(screen.queryByDisplayValue("security-agent")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Plan implemented -> Security/ }));
    expect(navigate).toHaveBeenCalledWith("/advanced/routing/route-security-incident");

    rerender(
      <AdvancedPage
        data={secondRouteData}
        validation={{ valid: true, diagnostics: [] }}
        advancedRoute="routing"
        selectedKey="route-security-incident"
        navigate={navigate}
      />
    );

    expect(screen.getByLabelText("Agent")).toHaveValue("security-agent");
    expect(screen.getByLabelText("Input event")).toHaveValue("plan.implemented.v1");
  });

  it("saves an emission rule from only the description, operation, condition, and event fields", async () => {
    const user = userEvent.setup();
    const refresh = vi.fn().mockResolvedValue(undefined);
    render(<AdvancedPage data={data} validation={{ valid: true, diagnostics: [] }} advancedRoute="emissions" refresh={refresh} />);

    expect(screen.getByRole("button", { name: /Publish plan implemented/ })).toBeVisible();
    expect(screen.getByLabelText("Description")).toBeVisible();
    expect(screen.getByLabelText("When this agent task finishes")).toHaveValue("developer-agent/implement@@1");
    expect(screen.getByLabelText("And output is")).toHaveValue("completed");
    expect(screen.getByLabelText("Publish this event")).toHaveValue("plan.implemented.v1");
    expect(screen.getByRole("button", { name: /^save emission rule$/i })).toBeVisible();
    expect(screen.queryByText("Event data preview")).not.toBeInTheDocument();
    expect(screen.queryByText("Checks before publishing")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Require a summary")).not.toBeInTheDocument();
    expect(screen.queryByText("Advanced details")).not.toBeInTheDocument();
    expect(screen.queryByText("Resource details")).not.toBeInTheDocument();
    expect(screen.queryByText("Advanced source")).not.toBeInTheDocument();
    expect(screen.queryByText("Enabled")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^edit$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^test$/i })).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText("Description"));
    await user.type(screen.getByLabelText("Description"), "Publish implementation when the task completes.");
    await user.click(screen.getByRole("button", { name: /^save emission rule$/i }));

    expect(apiMocks.save).toHaveBeenCalledWith("emissionPolicies", expect.objectContaining({
      observes: { operation: { id: "developer-agent/implement", version: 1 } },
      when: { path: "/output/status", op: "eq", value: "completed" },
      gates: [{ type: "required_value", path: "/output/summary" }],
      emissions: [expect.objectContaining({
        slot: "completed",
        eventType: "plan.implemented.v1",
        subject: { from: "/trigger/subject" },
        data: { object: {
          goal: { from: "/output/result/goal" },
          priority: { from: "/output/result/priority" }
        } },
        dedupeKey: { template: "emission:{{/run/id}}:emit-plan-implemented:completed" }
      })]
    }));
    expect(refresh).toHaveBeenCalled();
  });

  it("edits Flow boundaries with rule checkboxes and safety limits without raw LoopDefinition JSON", async () => {
    const user = userEvent.setup();
    const refresh = vi.fn().mockResolvedValue(undefined);
    render(<AdvancedPage data={data} validation={{ valid: true, diagnostics: [] }} advancedRoute="loops" refresh={refresh} />);

    expect(screen.getAllByRole("heading", { name: "Delivery loop" })[0]).toBeVisible();
    expect(screen.getByText("Flow boundary")).toBeVisible();
    expect(screen.getByLabelText("Starts when")).toHaveValue("plan.approved.v1");
    expect(screen.getByText("Routing rules included")).toBeVisible();
    expect(screen.getByText("Emission rules included")).toBeVisible();
    expect(screen.getByText("Ends when")).toBeVisible();
    expect(screen.getByLabelText("Maximum agent runs")).toHaveValue(8);
    expect(screen.queryByText("Advanced details")).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText("Maximum agent runs"));
    await user.type(screen.getByLabelText("Maximum agent runs"), "50");
    await user.click(screen.getByRole("button", { name: /^save flow boundary$/i }));

    expect(apiMocks.save).toHaveBeenCalledWith("loopDefinitions", expect.objectContaining({
      entryEventTypes: ["plan.approved.v1"],
      routingPolicyIds: ["route-plan-approved-to-implement"],
      emissionPolicyIds: ["emit-plan-implemented"],
      terminalEventTypes: ["plan.implemented.v1"],
      limits: expect.objectContaining({
        maxHops: 10,
        maxRuns: 50,
        maxIterationsPerStep: 2,
        deadlineSeconds: 3600
      }),
      onLimitExceeded: { eventType: "plan.implemented.v1" }
    }));
    expect(refresh).toHaveBeenCalled();
  });

  it("shows skill and runtime resources without delete-safety controls", () => {
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
    const skillsView = render(<AdvancedPage data={dataWithSkillAndRuntime} validation={{ valid: true, diagnostics: [] }} advancedRoute="skills" />);
    expect(screen.getByRole("button", { name: /TypeScript/ })).toBeVisible();
    expect(screen.queryByText("Developer")).not.toBeInTheDocument();
    expect(screen.queryByText("Enabled")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /check delete safety/i })).not.toBeInTheDocument();
    skillsView.unmount();

    render(<AdvancedPage data={dataWithSkillAndRuntime} validation={{ valid: true, diagnostics: [] }} advancedRoute="runtimes" />);
    expect(screen.getByRole("button", { name: /Codex CLI/ })).toBeVisible();
    expect(screen.queryByText("Developer")).not.toBeInTheDocument();
    expect(screen.queryByText("Enabled")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /check delete safety/i })).not.toBeInTheDocument();
    expect(apiMocks.checkSafeDelete).not.toHaveBeenCalled();
  });
});

describe("AdvancedPage data types", () => {
  it("shows versioned resources and visual next-version creation without source or delete-safety controls", async () => {
    const user = userEvent.setup();
    const refresh = vi.fn().mockResolvedValue(undefined);
    render(<AdvancedPage data={data} validation={{ valid: true, diagnostics: [] }} advancedRoute="contracts" refresh={refresh} />);

    expect(screen.getByRole("button", { name: /Plan approved data v1/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /Plan approved data v2/ })).toBeVisible();
    expect(screen.getAllByText("v1")[0]).toBeVisible();
    expect(screen.getAllByText("v2")[0]).toBeVisible();
    expect(screen.queryByText("Technical identity")).not.toBeInTheDocument();
    expect(screen.queryByText("Uses")).not.toBeInTheDocument();
    expect(screen.queryByText("Used by")).not.toBeInTheDocument();
    expect(screen.queryByText("Advanced source")).not.toBeInTheDocument();
    expect(screen.queryByText("Resource details")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /check delete safety/i })).not.toBeInTheDocument();
    expect(screen.getAllByText("Data shape")[0]).toBeVisible();
    expect(screen.getAllByText("Fields")[0]).toBeVisible();
    expect(screen.getAllByText("Business goal")[0]).toBeVisible();
    expect(screen.getAllByText("Schema preview")[0]).toBeVisible();
    expect(screen.getAllByText("Additional fields")[0]).toBeVisible();
    expect(screen.getAllByText("Blocked")[0]).toBeVisible();
    expect(screen.getAllByText("Example validation")[0]).toBeVisible();
    expect(screen.getAllByText("1 example matches this data shape.")[0]).toBeVisible();

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
