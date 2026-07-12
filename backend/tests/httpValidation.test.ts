import { describe, expect, it } from "vitest";
import {
    automationConfigSchema,
    collectionUpsertSchema,
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
      version: 6,
      loops: [{
        id: "delivery",
        theme: "open-ai",
        start: "implementation",
        steps: [{
          id: "implementation",
          type: "agent",
          description: "Implementation",
          nodeSize: "medium",
          agentId: "developer-agent",
          on: { approved: { end: "completed" }, rejected: { end: "failed" } }
        }]
      }]
    };
    expect(parseUnknown(automationConfigSchema, valid)).toEqual(valid);
    expectValidationError(() => parseUnknown(automationConfigSchema, { ...valid, events: [] }), "$");
    expectValidationError(() => parseUnknown(automationConfigSchema, { ...valid, triggers: [] }), "$");
    expectValidationError(() => parseUnknown(automationConfigSchema, { ...valid, version: 1 }), "version");
    expectValidationError(() => parseUnknown(automationConfigSchema, { ...valid, version: 3 }), "version");
    expectValidationError(() => parseUnknown(automationConfigSchema, { ...valid, version: 4 }), "version");
    expectValidationError(() => parseUnknown(automationConfigSchema, { ...valid, loops: undefined }), "loops");
    expectValidationError(() => parseUnknown(automationConfigSchema, { ...valid, gates: [] }), "$");
    expectValidationError(() => parseUnknown(automationConfigSchema, {
      ...valid,
      loops: [{ ...valid.loops[0], id: "Delivery" }]
    }), "loops.0.id");
    expectValidationError(() => parseUnknown(automationConfigSchema, {
      ...valid,
      loops: [{ ...valid.loops[0], steps: [{ ...valid.loops[0]!.steps[0], type: "human", agentId: "legacy" }] }]
    }), "loops.0.steps.0");
  });

  it("uses collection-specific upsert schemas", () => {
    expect(parseUnknown(collectionUpsertSchema("agents"), {
      name: "Developer",
      description: "Does work",
      instructions: "Implement",
      skills: [],
      enabled: true,
      avatar: "rocket",
      frontmatter: {}
    })).toMatchObject({ name: "Developer", avatar: "rocket", frontmatter: {} });

    expect(parseUnknown(collectionUpsertSchema("agents"), {
      id: "developer",
      avatar: null
    })).toEqual({ id: "developer", avatar: null });

    expectValidationError(() => parseUnknown(collectionUpsertSchema("agents"), {
      name: "Developer",
      avatar: "mars"
    }), "avatar");

    expectValidationError(() => parseUnknown(collectionUpsertSchema("agents"), {
      name: "Developer",
      nodeStyle: "luna"
    }), "$" );

    expectValidationError(() => parseUnknown(collectionUpsertSchema("agents"), {
      name: "Developer",
      status: "online"
    }), "$");

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
