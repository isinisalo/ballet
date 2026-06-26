import { describe, expect, it } from "vitest";
import type { ContractDefinition } from "../shared/contracts.js";
import { ContractRegistry, contractSchemaHash } from "../shared/contracts.js";

const at = "2026-06-25T08:00:00.000Z";

const eventContract: ContractDefinition = {
  id: "plan-approved-data",
  version: 1,
  name: "Plan approved data",
  description: "Data for plan approval.",
  kind: "event-data",
  active: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["goal"],
    properties: {
      goal: { type: "string", minLength: 1 },
      approvalStatus: { type: "string", enum: ["approved"] }
    }
  },
  examples: [{ goal: "Ship contracts", approvalStatus: "approved" }],
  createdAt: at,
  updatedAt: at
};

const inputContract: ContractDefinition = {
  ...eventContract,
  id: "developer-input",
  kind: "agent-input",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["workItemId"],
    properties: {
      workItemId: { type: "string" }
    }
  }
};

const outputContract: ContractDefinition = {
  ...eventContract,
  id: "developer-output",
  kind: "agent-output",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["status", "summary"],
    properties: {
      status: { type: "string", enum: ["completed", "blocked", "needs_input", "failed"] },
      summary: { type: "string", minLength: 1 },
      result: {
        type: "object",
        additionalProperties: false,
        properties: {
          gitSha: { type: "string" }
        }
      },
      evidence: {
        type: "object",
        additionalProperties: true
      }
    }
  }
};

describe("contract registry", () => {
  it("validates event data, operation input, and operation output", () => {
    const registry = new ContractRegistry([eventContract, inputContract, outputContract]);

    expect(registry.validate({ id: eventContract.id, version: 1 }, { goal: "Build", approvalStatus: "approved" }, "event-data").valid).toBe(true);
    expect(registry.validate({ id: inputContract.id, version: 1 }, { workItemId: "work-1" }, "agent-input").valid).toBe(true);
    expect(registry.validate({ id: outputContract.id, version: 1 }, { status: "completed", summary: "Done." }, "agent-output").valid).toBe(true);
  });

  it("returns useful validation errors", () => {
    const registry = new ContractRegistry([eventContract]);
    const result = registry.validate({ id: eventContract.id, version: 1 }, { approvalStatus: "rejected" }, "event-data");

    expect(result.valid).toBe(false);
    expect(result.errors.map((error) => error.instancePath)).toContain("");
    expect(result.errors.map((error) => error.keyword)).toContain("required");
    expect(result.errors.map((error) => error.instancePath)).toContain("/approvalStatus");
  });

  it("rejects duplicate active contract id/version pairs", () => {
    expect(() => new ContractRegistry([eventContract, { ...eventContract, name: "Duplicate" }])).toThrow("Duplicate active contract");
  });

  it("computes stable schema hashes", () => {
    const first = contractSchemaHash({
      schema: {
        type: "object",
        properties: {
          b: { type: "string" },
          a: { type: "number" }
        }
      }
    });
    const second = contractSchemaHash({
      schema: {
        properties: {
          a: { type: "number" },
          b: { type: "string" }
        },
        type: "object"
      }
    });

    expect(first).toBe(second);
  });

  it("requires agent-output contracts to include the common execution envelope", () => {
    expect(() => new ContractRegistry([
      {
        ...outputContract,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["decision"],
          properties: {
            decision: { type: "string" }
          }
        }
      }
    ])).toThrow("must require status and summary");

    expect(() => new ContractRegistry([
      {
        ...outputContract,
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
    ])).toThrow("must define status, summary, result, and evidence");
  });
});
