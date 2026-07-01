import { describe, expect, it } from "vitest";
import { parseUnknown, HttpValidationError } from "../http/validation/httpValidation.js";
import {
  automationConfigSchema,
  collectionUpsertSchema,
  eventIntakeSchema,
  projectDocumentSaveSchema
} from "../../shared/api/workspace-schemas.js";

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
      triggers: [{ id: "manual-start", description: "Manual start" }],
      actions: [{ id: "implementation", description: "Implementation", outputIds: ["summary"] }],
      outputs: [{ id: "summary", description: "Summary artifact" }],
      policies: [{
        id: "on.trigger.manual-start.then.developer.start.implementation",
        source: "trigger",
        trigger: "manual-start",
        agent: "developer",
        action: "implementation",
        enabled: true
      }],
      workflows: [{ id: "delivery", title: "Delivery", steps: ["on.trigger.manual-start.then.developer.start.implementation"] }],
      runtimes: [{ id: "codex", title: "Codex", command: "codex", args: [] }]
    };
    expect(parseUnknown(automationConfigSchema, valid)).toEqual(valid);
    expectValidationError(() => parseUnknown(automationConfigSchema, { ...valid, events: [] }), "$");
    expectValidationError(() => parseUnknown(automationConfigSchema, { ...valid, actions: undefined }), "actions");
    expectValidationError(() => parseUnknown(automationConfigSchema, { ...valid, outputs: undefined }), "outputs");
    expectValidationError(() => parseUnknown(automationConfigSchema, { ...valid, actions: [{ id: "implementation", description: "Implementation" }] }), "actions.0.outputIds");
    expectValidationError(() => parseUnknown(automationConfigSchema, { ...valid, outputs: [{ id: "summary", description: "Summary", extra: true }] }), "outputs.0");
  });

  it("accepts valid event intake payloads and defaults payload to an object", () => {
    expect(parseUnknown(eventIntakeSchema, {
      projectId: "project",
      eventType: "trigger.manual-start",
      tags: ["manual"],
      correlationDepth: 0
    })).toEqual({
      projectId: "project",
      eventType: "trigger.manual-start",
      tags: ["manual"],
      correlationDepth: 0,
      payload: {}
    });

    expectValidationError(() => parseUnknown(eventIntakeSchema, {
      projectId: "project",
      eventType: "trigger.manual-start",
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
