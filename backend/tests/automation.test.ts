import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Agent } from "../../shared/domain/agents.js";
import type { ProjectAutomationConfig } from "../../shared/domain/automation.js";
import {
  actionOutputEventType,
  actionOutputIds,
  actionRouteId,
  humanGateResponseId
} from "../../shared/policy-actions.js";
import { actionOutputEventType as aggregatedOutputEventType, aggregateActionOutputStatus } from "../automation/actionOutputAggregator.js";
import {
  automationActionsToEventDefinitions,
  loadProjectAutomationConfig,
  normalizeProjectAutomationConfig,
  saveProjectAutomationConfig,
  validateProjectAutomationConfig
} from "../automation.js";
import { mapAgentOutputToEvent } from "../automation/agentOutputEventMapper.js";

const tempRoots: string[] = [];

const tempRoot = async () => {
  const root = await mkdtemp(path.join(tmpdir(), "ballet-automation-"));
  tempRoots.push(root);
  return root;
};

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const agent: Agent = {
  id: "developer-agent",
  name: "Developer Agent",
  description: "Implements work.",
  instructions: "Do the work.",
  skills: [],
  enabled: true,
  status: "online",
  createdAt: "2026-06-24T08:00:00.000Z",
  updatedAt: "2026-06-24T08:00:00.000Z"
};

const loopId = "plan-approved.loop";
const startEvent = "plan-approved";
const implementationActionId = "implementation";
const humanReviewActionId = "human-review";
const implementationRejectedEvent = actionOutputEventType({ loopId, actionId: implementationActionId }, "rejected");

const validConfig = (): ProjectAutomationConfig => ({
  version: 1,
  actions: [{
    id: implementationActionId,
    description: "Implement approved work.",
    agentId: "developer-agent"
  }, {
    id: humanReviewActionId,
    description: "Review rejected implementation.",
    humanGate: true
  }],
  outputRoutes: [{
    sourceLoopId: loopId,
    sourceActionId: implementationActionId,
    outputId: "rejected",
    targetLoopId: loopId,
    targetActionId: humanReviewActionId
  }],
  humanGateResponses: [],
  loops: [{ id: loopId, steps: [implementationActionId, humanReviewActionId] }],
  runtimes: [{
    id: "codex-runtime",
    title: "Codex runtime",
    command: "codex",
    args: ["app-server", "--listen", "stdio://"]
  }]
});

describe("project automation config", () => {
  it("returns default config without automation policies when .ballet/project.json is missing", async () => {
    await expect(loadProjectAutomationConfig(await tempRoot())).resolves.toEqual({
      version: 1,
      actions: [],
      outputRoutes: [],
      humanGateResponses: [],
      loops: [],
      runtimes: []
    });
  });

  it("keeps repository automation configs in the compact action shape", async () => {
    for (const relativePath of [".ballet/project.json", ".fixture-ballet-project/.ballet/project.json"]) {
      const raw = JSON.parse(await readFile(path.join(process.cwd(), relativePath), "utf8")) as Record<string, unknown>;
      expect(raw).not.toHaveProperty("policies");
      expect(raw).not.toHaveProperty("triggers");
      expect(raw).not.toHaveProperty("gates");
      expect(raw).not.toHaveProperty("gateDecisions");
      expect(raw).not.toHaveProperty("outputs");
      expect(Array.isArray(raw.actions)).toBe(true);
      expect(Array.isArray(raw.outputRoutes)).toBe(true);
      expect(Array.isArray(raw.humanGateResponses)).toBe(true);
      expect(validateProjectAutomationConfig(raw)).toEqual([]);
      expect((raw.actions as Array<Record<string, unknown>>).some((action) =>
        "key" in action || "event" in action || "loopId" in action || "enabled" in action || "outputIds" in action
      )).toBe(false);
    }
  });

  it("saves readable canonical JSON without touching Markdown instructions", async () => {
    const root = await tempRoot();
    await mkdir(path.join(root, ".ballet/instructions"), { recursive: true });
    const instructionPath = path.join(root, ".ballet/instructions/code-review.md");
    await writeFile(instructionPath, "# Code review\n", "utf8");

    const saved = await saveProjectAutomationConfig(root, validConfig(), [agent]);
    const rawSaved = JSON.parse(await readFile(path.join(root, ".ballet/project.json"), "utf8")) as Record<string, unknown>;

    expect(saved).toEqual(normalizeProjectAutomationConfig(validConfig(), [agent]));
    expect(rawSaved).not.toHaveProperty("policies");
    expect(rawSaved).not.toHaveProperty("outputs");
    expect((rawSaved.actions as ProjectAutomationConfig["actions"])[0]?.id).toBe(implementationActionId);
    expect((rawSaved.actions as Array<Record<string, unknown>>)[0]).not.toHaveProperty("key");
    expect((rawSaved.actions as Array<Record<string, unknown>>)[0]).not.toHaveProperty("event");
    expect((rawSaved.actions as Array<Record<string, unknown>>)[0]).not.toHaveProperty("loopId");
    expect((rawSaved.actions as Array<Record<string, unknown>>)[0]).not.toHaveProperty("enabled");
    expect((rawSaved.loops as ProjectAutomationConfig["loops"])[0]?.steps).toEqual([implementationActionId, humanReviewActionId]);
    expect(await readFile(instructionPath, "utf8")).toBe("# Code review\n");
    await expect(loadProjectAutomationConfig(root, [agent])).resolves.toEqual(saved);
  });

  it("normalizes legacy automation policies without preserving custom outputs", () => {
    const legacy = {
      version: 1,
      actions: [
        { id: "implementation", description: "Implement.", agentId: "developer-agent" },
        { id: "human-review", description: "Human review.", humanGate: true }
      ],
      outputRoutes: [{
        sourcePolicyId: "start-implementation",
        outputId: "rejected",
        target: { type: "policy", policyId: "human-review-handler" }
      }],
      humanGateResponses: [{
        id: "legacy-response",
        loopId,
        policyId: "human-review-handler",
        outputId: "approved",
        prompt: "Continue?",
        submittedAt: "2026-07-07T10:00:00.000Z"
      }],
      policies: [{
        id: "start-implementation",
        source: "event",
        event: startEvent,
        action: "implementation",
        enabled: true
      }, {
        id: "human-review-handler",
        source: "event",
        event: `${loopId}.implementation.rejected`,
        action: "human-review",
        enabled: true
      }],
      loops: [{ id: loopId, steps: ["start-implementation", "human-review-handler"] }],
      runtimes: []
    };

    const normalized = normalizeProjectAutomationConfig(legacy, [agent]);

    expect(normalized).not.toHaveProperty("policies");
    expect(normalized.actions.map((action) => action.id)).toEqual(["implementation", "human-review"]);
    expect(normalized.outputRoutes).toEqual([{
      sourceLoopId: loopId,
      sourceActionId: "implementation",
      outputId: "rejected",
      targetLoopId: loopId,
      targetActionId: "human-review"
    }]);
      expect(normalized.humanGateResponses).toEqual([{
      id: humanGateResponseId({ loopId, actionId: "human-review" }),
      loopId,
      actionId: "human-review",
      outputId: "approved",
      prompt: "Continue?",
      submittedAt: "2026-07-07T10:00:00.000Z"
    }]);
    expect(normalized.loops[0]?.steps).toEqual(["implementation", "human-review"]);
    expect(validateProjectAutomationConfig(normalized, [agent])).toEqual([]);
  });

  it("deduplicates inflated handler actions back to compact actions", () => {
    const inflated = {
      version: 1,
      actions: [
        { id: "on.plan-approved.start.plan-approved.loop.implementation", key: "implementation", loopId, event: startEvent, description: "Implement.", agentId: "developer-agent", enabled: true },
        { id: "on.plan-approved.loop.implementation.rejected.start.plan-approved.loop.implementation", key: "implementation", loopId, event: implementationRejectedEvent, description: "Implement.", agentId: "developer-agent", enabled: true }
      ],
      loops: [{ id: loopId, steps: ["on.plan-approved.start.plan-approved.loop.implementation", "on.plan-approved.loop.implementation.rejected.start.plan-approved.loop.implementation"] }]
    };

    const normalized = normalizeProjectAutomationConfig(inflated, [agent]);

    expect(normalized.actions.map((action) => action.id)).toEqual(["implementation"]);
    expect(normalized.loops[0]?.steps).toEqual(["implementation"]);
  });

  it("validates actions, scoped routes, loops, and human gate responses", () => {
    const reviewerAgent = { ...agent, id: "reviewer-agent", name: "Reviewer Agent" };
    expect(validateProjectAutomationConfig(validConfig(), [agent])).toEqual([]);
    expect(validateProjectAutomationConfig({ ...validConfig(), policies: [] }, [agent]).some((issue) =>
      issue.message === "Automation policies are no longer supported. Use action event handlers."
    )).toBe(true);
    expect(validateProjectAutomationConfig({
      ...validConfig(),
      actions: [{ ...validConfig().actions[0]!, agentIds: ["developer-agent", "reviewer-agent"] }]
    }, [agent, reviewerAgent]).some((issue) => issue.message === "Action agentIds is no longer supported. Use agentId.")).toBe(true);
    expect(validateProjectAutomationConfig({
      ...validConfig(),
      outputs: [{ id: "approved" }]
    }, [agent]).some((issue) => issue.message === "Automation outputs are fixed to approved/rejected and are no longer configurable.")).toBe(true);
    expect(validateProjectAutomationConfig({
      ...validConfig(),
      actions: [{ ...validConfig().actions[0]!, outputIds: ["approved"] }]
    }, [agent]).some((issue) => issue.message === "Action outputIds is no longer supported. Outputs are fixed to approved/rejected.")).toBe(true);
    expect(validateProjectAutomationConfig({
      ...validConfig(),
      actions: [{ ...validConfig().actions[0]!, agentId: "missing-agent" }]
    }, [agent]).some((issue) => issue.message === "Action references unknown agent: missing-agent.")).toBe(true);
    expect(validateProjectAutomationConfig({
      ...validConfig(),
      outputRoutes: [{ sourceLoopId: loopId, sourceActionId: implementationActionId, outputId: "summary", targetLoopId: loopId, targetActionId: humanReviewActionId }]
    }, [agent]).some((issue) =>
      issue.message === "Output route outputId must be approved or rejected."
    )).toBe(true);
    expect(validateProjectAutomationConfig({
      ...validConfig(),
      outputRoutes: [{ sourceLoopId: loopId, sourceActionId: implementationActionId, outputId: "approved", targetLoopId: loopId, targetActionId: "missing-action" }]
    }, [agent]).some((issue) =>
      issue.message === "Output route references unknown target action: missing-action."
    )).toBe(true);

    const response = {
      id: humanGateResponseId({ loopId, actionId: humanReviewActionId }),
      loopId,
      actionId: humanReviewActionId,
      outputId: "approved",
      prompt: "Continue with the approved path.",
      submittedAt: "2026-07-07T10:00:00.000Z"
    };
    expect(validateProjectAutomationConfig({
      ...validConfig(),
      humanGateResponses: [response]
    }, [agent])).toEqual([]);
    expect(validateProjectAutomationConfig({
      ...validConfig(),
      humanGateResponses: [{ ...response, actionId: implementationActionId }]
    }, [agent]).some((issue) =>
      issue.message === `Human gate response action is not a human gate: ${implementationActionId}.`
    )).toBe(true);
  });

  it("derives runtime event definitions from loops and action outputs", () => {
    const config = validConfig();
    const eventTypes = automationActionsToEventDefinitions(
      config.actions,
      config.outputRoutes,
      config.loops
    ).map((event) => event.eventType);

    expect(eventTypes).toEqual(expect.arrayContaining([
      startEvent,
      actionOutputEventType({ loopId, actionId: implementationActionId }, "approved"),
      implementationRejectedEvent
    ]));
  });

  it("maps aggregated agent outcomes through action output events", () => {
    const config = validConfig();
    const action = config.actions[0]!;
    const outputStatus = aggregateActionOutputStatus([{
      runId: "run-1",
      inputEventId: "event-1",
      actionId: action.id,
      loopId,
      routeId: actionRouteId(loopId, action.id),
      actionVersion: 1,
      agentRole: "developer-agent",
      status: "failed",
      attempt: 1,
      createdAt: "2026-07-07T10:00:00.000Z",
      updatedAt: "2026-07-07T10:01:00.000Z",
      completedAt: "2026-07-07T10:01:00.000Z",
      outcome: { outcome: "failed", summary: "Failed.", checks: [] }
    }], action, config.actions);

    expect(actionOutputIds(config.actions, action.id)).toEqual(["approved", "rejected"]);
    expect(outputStatus).toBe("rejected");
    expect(aggregatedOutputEventType({ ...action, loopId }, outputStatus!, config.outputRoutes, config.actions)).toBe(implementationRejectedEvent);
    expect(mapAgentOutputToEvent(action, { status: "failed", loopId, actionId: action.id }, config.outputRoutes, config.actions)).toMatchObject({
      id: implementationRejectedEvent,
      payload: {
        action: "implementation",
        status: "rejected",
        action_id: action.id,
        loop_id: loopId
      }
    });
  });
});
