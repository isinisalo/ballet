import { describe, expect, it } from "vitest";
import {
    automationConfigSchema,
    collectionUpsertSchema,
    projectDocumentSaveSchema
} from "../../shared/api/workspace-schemas.js";
import { agentOutcomeSchema, respondToRunStepBodySchema } from "../../shared/api/runtime-schemas.js";
import { defaultTerminalNodes } from "../../shared/domain/automation.js";
import { parseUnknown } from "../http/validation/httpValidation.js";
import { expectValidationError } from "./expectValidationError.js";

describe("AgentOutcome validation", () => {
  it("enforces the discriminated AgentOutcome contract", () => {
    const validOutcomes = [
      { state: "completed", result: "approved", summary: "Approved.", checks: [] },
      { state: "completed", result: "rejected", summary: "Changes are required.", checks: [] },
      {
        state: "needs_input",
        question: "Which environment should be used?",
        context: "The task does not identify an environment.",
        summary: "Waiting for an environment choice.",
        checks: []
      },
      { state: "blocked", summary: "A required dependency is unavailable.", checks: [] },
      { state: "failed", summary: "The provider process exited.", checks: [] }
    ];
    for (const outcome of validOutcomes) {
      expect(parseUnknown(agentOutcomeSchema, outcome)).toEqual(outcome);
    }

    const invalidOutcomes = [
      ["legacy ready", { outcome: "ready", summary: "Ready.", checks: [] }, "state"],
      [
        "legacy changes-requested",
        { outcome: "changes-requested", summary: "Changes are required.", checks: [] },
        "state"
      ],
      ["completed without result", { state: "completed", summary: "Done.", checks: [] }, "result"],
      [
        "non-completed with result",
        { state: "blocked", result: "approved", summary: "Blocked.", checks: [] },
        "$"
      ],
      [
        "needs_input without question",
        { state: "needs_input", context: "Context.", summary: "Waiting.", checks: [] },
        "question"
      ],
      [
        "needs_input without context",
        { state: "needs_input", question: "Continue?", summary: "Waiting.", checks: [] },
        "context"
      ]
    ] as const;
    for (const [, outcome, path] of invalidOutcomes) {
      expectValidationError(() => parseUnknown(agentOutcomeSchema, outcome), path);
    }
  });
});

describe("HTTP Zod validation", () => {
  it("distinguishes human decisions from agent input resumes", () => {
    expect(parseUnknown(respondToRunStepBodySchema, {
      kind: "human",
      result: "approved",
      input: "Looks good."
    })).toEqual({ kind: "human", result: "approved", input: "Looks good." });
    expect(parseUnknown(respondToRunStepBodySchema, {
      kind: "resume",
      input: "Use SQLite."
    })).toEqual({ kind: "resume", input: "Use SQLite." });
    expectValidationError(() => parseUnknown(respondToRunStepBodySchema, {
      kind: "resume",
      result: "approved",
      input: "Use SQLite."
    }), "$");
    expectValidationError(() => parseUnknown(respondToRunStepBodySchema, {
      kind: "human",
      input: "Looks good."
    }), "result");
    expectValidationError(() => parseUnknown(respondToRunStepBodySchema, {
      kind: "resume",
      input: "   "
    }), "input");
  });

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
      version: 8,
      loops: [{
        id: "delivery",
        start: "implementation",
        nodes: [{
          id: "implementation",
          type: "agent",
          description: "Implementation",
          nodeStyle: "terra",
          nodeSize: "medium",
          agentId: "developer-agent",
          on: { approved: "completed", rejected: "failed" }
        }, ...defaultTerminalNodes()]
      }]
    };
    expect(parseUnknown(automationConfigSchema, valid)).toEqual(valid);
    expectValidationError(() => parseUnknown(automationConfigSchema, { ...valid, events: [] }), "$");
    expectValidationError(() => parseUnknown(automationConfigSchema, { ...valid, triggers: [] }), "$");
    expectValidationError(() => parseUnknown(automationConfigSchema, { ...valid, version: 1 }), "version");
    expectValidationError(() => parseUnknown(automationConfigSchema, { ...valid, version: 3 }), "version");
    expectValidationError(() => parseUnknown(automationConfigSchema, { ...valid, version: 4 }), "version");
    expectValidationError(() => parseUnknown(automationConfigSchema, { ...valid, version: 7 }), "version");
    expectValidationError(() => parseUnknown(automationConfigSchema, { ...valid, loops: undefined }), "loops");
    expectValidationError(() => parseUnknown(automationConfigSchema, { ...valid, gates: [] }), "$");
    expectValidationError(() => parseUnknown(automationConfigSchema, {
      ...valid,
      loops: [{ ...valid.loops[0], id: "Delivery" }]
    }), "loops.0.id");
    expectValidationError(() => parseUnknown(automationConfigSchema, {
      ...valid,
      loops: [{ ...valid.loops[0], nodes: [{ ...valid.loops[0]!.nodes[0], type: "human", agentId: "legacy" }, ...defaultTerminalNodes()] }]
    }), "loops.0.nodes.0");
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
      avatar: null,
      relativePath: "README.md",
      slug: "forged",
      errors: ["forged"],
      createdAt: "forged",
      updatedAt: "forged"
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
