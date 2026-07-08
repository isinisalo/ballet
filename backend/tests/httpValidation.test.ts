import { describe, expect, it } from "vitest";
import {
    automationConfigSchema,
    collectionUpsertSchema,
    eventIntakeSchema,
    projectDocumentSaveSchema
} from "../../shared/api/workspace-schemas.js";
import { HttpValidationError, parseUnknown } from "../http/validation/httpValidation.js";

const expectValidationError = (callback: () => unknown, path: string) => {
  expect(callback).toThrow(HttpValidationError);
  try {
    callback();
  } catch (error) {
    expect(error).toBeInstanceOf(HttpValidationError);
    expect((error as HttpValidationError).issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ path })
    ]));
  }
};

describe("HTTP Zod validation", () => {
  it("accepts valid project document saves and rejects unknown top-level fields", () => {
    const valid = {
      relativePath: ".ballet/project.md",
      frontmatter: { title: "Project", nested: { ok: true } },
      body: "Body"
    };
    expect(parseUnknown(projectDocumentSaveSchema, valid)).toEqual(valid);
    expectValidationError(() => parseUnknown(projectDocumentSaveSchema, { ...valid, extra: true }), "$");
  });

  it("accepts valid automation configs and rejects malformed automation payloads", () => {
    const valid = {
      version: 1,
      actions: [{ id: "implementation", description: "Implementation", outputIds: ["summary"], agentIds: ["developer-agent"] }],
      outputs: [{ id: "summary" }],
      outputRoutes: [],
      humanGateResponses: [],
      policies: [{
        id: "on.implementation.summary.start.implementation",
        source: "event",
        event: "implementation.summary",
        action: "implementation",
        enabled: true
      }],
      loops: [{ id: "delivery", steps: ["on.implementation.summary.start.implementation"] }],
      runtimes: [{ id: "codex", title: "Codex", command: "codex", args: [] }]
    };
    expect(parseUnknown(automationConfigSchema, valid)).toEqual(valid);
    const humanGateConfig = {
      ...valid,
      actions: [...valid.actions, { id: "human-review", description: "Human review", outputIds: ["summary"], agentIds: [], humanGate: true }],
      humanGateResponses: [{
        id: "delivery:on-implementation-summary-start-review:human-review",
        loopId: "delivery",
        policyId: "on.implementation.summary.start.human-review",
        actionId: "human-review",
        outputId: "summary",
        prompt: "Continue with the approved brief.",
        submittedAt: "2026-07-07T10:00:00.000Z"
      }],
      policies: [...valid.policies, {
        id: "on.implementation.summary.start.human-review",
        source: "event",
        event: "implementation.summary",
        action: "human-review",
        enabled: true
      }]
    };
    expect(parseUnknown(automationConfigSchema, humanGateConfig)).toMatchObject({
      actions: expect.arrayContaining([expect.objectContaining({ id: "human-review", humanGate: true })]),
      humanGateResponses: [expect.objectContaining({ actionId: "human-review", prompt: "Continue with the approved brief." })]
    });
    expectValidationError(() => parseUnknown(automationConfigSchema, {
      ...humanGateConfig,
      humanGateResponses: [{ ...humanGateConfig.humanGateResponses[0], prompt: "" }]
    }), "humanGateResponses.0.prompt");
    expectValidationError(() => parseUnknown(automationConfigSchema, { ...valid, events: [] }), "$");
    expectValidationError(() => parseUnknown(automationConfigSchema, { ...valid, triggers: [] }), "$");
    expectValidationError(() => parseUnknown(automationConfigSchema, { ...valid, actions: undefined }), "actions");
    expectValidationError(() => parseUnknown(automationConfigSchema, { ...valid, outputs: undefined }), "outputs");
    expectValidationError(() => parseUnknown(automationConfigSchema, { ...valid, outputRoutes: undefined }), "outputRoutes");
    expectValidationError(() => parseUnknown(automationConfigSchema, { ...valid, humanGateResponses: undefined }), "humanGateResponses");
    expectValidationError(() => parseUnknown(automationConfigSchema, { ...valid, gates: [] }), "$");
    expectValidationError(() => parseUnknown(automationConfigSchema, {
      ...valid,
      outputRoutes: [{ sourcePolicyId: "on.implementation.summary.start.implementation", outputId: "summary", target: { type: "gate", gate: "human-review" } }]
    }), "outputRoutes.0.target.type");
    expectValidationError(() => parseUnknown(automationConfigSchema, { ...valid, actions: [{ id: "implementation", description: "Implementation", outputIds: ["summary"] }] }), "actions.0.agentIds");
    expectValidationError(() => parseUnknown(automationConfigSchema, { ...valid, outputs: [{ id: "summary", description: "Summary" }] }), "outputs.0");
    expectValidationError(() => parseUnknown(automationConfigSchema, { ...valid, outputs: [{ id: "summary", type: "event" }] }), "outputs.0");
  });

  it("accepts valid event intake payloads and defaults payload to an object", () => {
    expect(parseUnknown(eventIntakeSchema, {
      projectId: "project",
      eventType: "manual-start",
      tags: ["manual"],
      correlationDepth: 0
    })).toEqual({
      projectId: "project",
      eventType: "manual-start",
      tags: ["manual"],
      correlationDepth: 0,
      payload: {}
    });

    expectValidationError(() => parseUnknown(eventIntakeSchema, {
      projectId: "project",
      eventType: "manual-start",
      correlationDepth: -1
    }), "correlationDepth");
  });

  it("uses collection-specific upsert schemas", () => {
    expect(parseUnknown(collectionUpsertSchema("agents"), {
      name: "Developer",
      description: "Does work",
      instructions: "Implement",
      skills: [],
      enabled: true,
      status: "offline",
      frontmatter: { runtime: "codex" }
    })).toMatchObject({ name: "Developer", frontmatter: { runtime: "codex" } });

    expect(parseUnknown(collectionUpsertSchema("skills"), {
      name: "Kubernetes",
      description: "Triage",
      metadata: { domain: "platform" }
    })).toMatchObject({ metadata: { domain: "platform" } });

    expectValidationError(() => parseUnknown(collectionUpsertSchema("agents"), {
      name: "Developer",
      unexpected: true
    }), "$");
  });
});
