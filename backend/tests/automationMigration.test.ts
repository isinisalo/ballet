import { describe, expect, it } from "vitest";
import { automationConfigSchema } from "../../shared/api/workspace-schemas.js";
import { migrateAutomationConfig } from "../../shared/domain/automationMigration.js";

describe("automation action migration", () => {
  it("maps the opinionated v8 outcome model to behavior-equivalent actions", () => {
    const legacy = configWithNodes([agentNode("work", {
      ready: "verify",
      approved: { loop: "release" },
      "changes-requested": { repair: "repair" },
      needs_input: { human: "gate" },
      blocked: { terminal: "blocked" },
      failed: { terminal: "failed", retry: { when: "transient", limit: 1 } }
    })]);

    const migrated = migrateAutomationConfig(legacy) as typeof legacy;
    expect(migrated.loops[0]!.nodes[0]!.on).toEqual({
      ready: { action: "goto", target: "verify" },
      approved: { action: "goto", target: { loop: "release" } },
      "changes-requested": {
        action: "retry",
        target: "repair",
        policy: {
          maxAttempts: 3,
          stallDetection: "same-evidence",
          onExhausted: { action: "terminate", status: "blocked" }
        }
      },
      needs_input: { action: "goto", target: "gate", input: "signal" },
      blocked: { action: "terminate", status: "blocked" },
      failed: {
        action: "retry",
        policy: {
          maxAttempts: 1,
          when: { failureClassification: "transient" },
          onExhausted: { action: "terminate", status: "failed" }
        }
      }
    });
  });

  it("expands binary agent and human transitions deterministically", () => {
    const legacy = configWithNodes([
      agentNode("work", { approved: "gate", rejected: "repair" }),
      agentNode("repair", { approved: "gate", rejected: "blocked" }),
      humanNode("gate", { approved: "completed", rejected: "repair" })
    ]);

    const migrated = migrateAutomationConfig(legacy) as typeof legacy;
    expect(migrated.loops[0]!.nodes[0]!.on).toMatchObject({
      ready: { action: "goto", target: "gate" },
      approved: { action: "goto", target: "gate" },
      "changes-requested": {
        action: "retry",
        target: "repair",
        policy: { maxAttempts: 3, stallDetection: "same-evidence" }
      },
      needs_input: { action: "goto", target: "gate", input: "signal" },
      blocked: { action: "terminate", status: "blocked" },
      failed: {
        action: "retry",
        policy: {
          maxAttempts: 1,
          when: { failureClassification: "transient" },
          onExhausted: { action: "terminate", status: "failed" }
        }
      }
    });
    expect(migrated.loops[0]!.nodes[2]!.on).toEqual({
      approved: { action: "goto", target: "completed", input: "append-signal" },
      rejected: {
        action: "retry",
        target: "repair",
        input: "append-signal",
        policy: {
          maxAttempts: 3,
          onExhausted: { action: "terminate", status: "blocked" }
        }
      }
    });
  });
});

describe("automation action migration safeguards", () => {
  it("is idempotent for canonical generic actions and preserves custom policy values", () => {
    const canonical = configWithNodes([agentNode("work", {
      ready: { action: "terminate", status: "failed" },
      approved: { action: "goto", target: "work" },
      "changes-requested": { action: "wait", resume: "same-step", input: "signal" },
      needs_input: { action: "goto", target: { loop: "other" }, input: "append-signal" },
      blocked: {
        action: "retry",
        target: "work",
        policy: {
          maxAttempts: 9,
          stallDetection: "same-evidence",
          onExhausted: { action: "wait", resume: { target: "work" } }
        }
      },
      failed: { action: "terminate", status: "completed" }
    })]);

    const once = migrateAutomationConfig(canonical);
    const twice = migrateAutomationConfig(once);
    expect(once).toEqual(canonical);
    expect(twice).toEqual(canonical);
  });

  it("leaves malformed binary transitions malformed for strict validation", () => {
    const malformed = configWithNodes([humanNode("gate", { approved: "completed", rejected: 123 })]);
    expect(migrateAutomationConfig(malformed)).toEqual(malformed);
  });

  it("does not reinterpret mixed generic and opinionated outcome transitions", () => {
    const mixed = configWithNodes([agentNode("work", {
      ready: { action: "goto", target: "completed" },
      approved: "completed",
      "changes-requested": { terminate: "blocked" },
      needs_input: { wait: true },
      blocked: { terminal: "blocked" },
      failed: { terminal: "failed" }
    })]);
    expect(migrateAutomationConfig(mixed)).toEqual(mixed);
  });

  it.each([{ foo: "bar" }, { terminal: "completed" }])(
    "rejects malformed opinionated terminal transition $terminal",
    (blocked) => {
      const malformed = configWithNodes([agentNode("work", {
        ready: "completed",
        approved: "completed",
        "changes-requested": { terminate: "blocked" },
        needs_input: { wait: true },
        blocked,
        failed: { terminal: "failed" }
      })]);
      expect(migrateAutomationConfig(malformed)).toEqual(malformed);
      expect(automationConfigSchema.safeParse(malformed).success).toBe(false);
    }
  );
});

const configWithNodes = (nodes: Array<Record<string, unknown>>) => ({
  version: 8,
  loops: [{ id: "fixture", start: String(nodes[0]?.id ?? "work"), nodes }]
});

const agentNode = (id: string, on: Record<string, unknown>) => ({
  id,
  type: "agent",
  agentId: "agent",
  description: "",
  nodeStyle: "flat",
  nodeSize: "medium",
  on
});

const humanNode = (id: string, on: Record<string, unknown>) => ({
  id,
  type: "human",
  description: "",
  nodeStyle: "flat",
  nodeSize: "tiny",
  on
});
