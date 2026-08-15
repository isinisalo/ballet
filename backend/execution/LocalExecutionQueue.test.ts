import { z } from "zod";
import { describe, expect, it, vi } from "vitest";
import { stepOutcomeSchema } from "../../shared/api/runtime-schemas.js";
import { createFixture, specification, waitFor } from "./LocalExecutionQueue.test-fixture.js";

describe("LocalExecutionQueue startup and claim boundaries", () => {
  it("does not pump a reconciliation wake before startup recovery completes", async () => {
    const fixture = await createFixture();
    fixture.insertRoot("root", ["deferred"]);
    fixture.store.create(specification("deferred", "root"));

    fixture.queue.wake("codex");
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(fixture.codex.started).toEqual([]);
    expect(fixture.store.require("deferred").status).toBe("queued");
    await fixture.queue.start();
    await waitFor(() => fixture.store.require("deferred").status === "succeeded");
    expect(fixture.codex.started).toEqual(["deferred"]);
    await fixture.close();
  });

  it.each(["queued", "running"] as const)(
    "never invokes the adapter for a persisted %s task whose Root is terminal at startup",
    async (status) => {
      const fixture = await createFixture();
      fixture.insertRoot("root", ["stale"]);
      fixture.store.create(specification("stale", "root"));
      if (status === "running") expect(fixture.store.claim("stale")?.status).toBe("running");
      fixture.connection().prepare(`
        UPDATE root_runs SET status = 'failed', completed_at = updated_at WHERE root_run_id = 'root'
      `).run();

      await fixture.queue.start();
      await waitFor(() => ["cancelled", "failed"].includes(fixture.store.require("stale").status));

      expect(fixture.codex.started).toEqual([]);
      expect(fixture.connection().prepare(`
        SELECT status FROM root_runs WHERE root_run_id = 'root'
      `).get()).toEqual({ status: "failed" });
      expect(fixture.store.require("stale").status).toBe(status === "queued" ? "cancelled" : "failed");
      await fixture.close();
    }
  );

  it("allows only one caller to win a queued task claim", async () => {
    const fixture = await createFixture();
    fixture.insertRoot("root", ["claimed"]);
    fixture.store.create(specification("claimed", "root"));

    const winner = fixture.store.claim("claimed");
    const loser = fixture.store.claim("claimed");

    expect(winner?.status).toBe("running");
    expect(loser).toBeUndefined();
    expect(fixture.codex.started).toEqual([]);
    await fixture.close();
  });
});

describe("LocalExecutionQueue scheduling and cancellation", () => {
  it("runs provider FIFO queues one-at-a-time while Codex and Copilot overlap", async () => {
    const fixture = await createFixture();
    fixture.insertRoot("codex-root", ["codex-a", "codex-b"]);
    fixture.insertRoot("copilot-root", ["copilot-a"]);
    fixture.store.create(specification("codex-a", "codex-root", "codex", "2026-01-01T00:00:00.000Z"));
    fixture.store.create(specification("codex-b", "codex-root", "codex", "2026-01-01T00:00:00.001Z"));
    fixture.store.create(specification("copilot-a", "copilot-root", "copilot", "2026-01-01T00:00:00.000Z"));
    fixture.codex.hold("codex-a");
    fixture.copilot.hold("copilot-a");

    fixture.queue.start();
    await waitFor(() => fixture.codex.started.includes("codex-a") && fixture.copilot.started.includes("copilot-a"));

    expect(fixture.codex.started).toEqual(["codex-a"]);
    expect(fixture.store.require("codex-b").status).toBe("queued");
    expect(fixture.store.require("codex-a").status).toBe("running");
    expect(fixture.store.require("copilot-a").status).toBe("running");

    fixture.copilot.release("copilot-a");
    await waitFor(() => fixture.store.require("copilot-a").status === "succeeded");
    fixture.codex.release("codex-a");
    await waitFor(() => fixture.store.require("codex-b").status === "succeeded");

    expect(fixture.codex.started).toEqual(["codex-a", "codex-b"]);
    expect(fixture.codex.maximumActive).toBe(1);
    expect(fixture.copilot.maximumActive).toBe(1);
    expect(fixture.terminal.map(({ id }) => id)).toEqual(expect.arrayContaining(["codex-a", "codex-b", "copilot-a"]));
    await fixture.close();
  });

  it("cancels queued work idempotently without invoking the adapter", async () => {
    const fixture = await createFixture();
    fixture.insertRoot("root", ["running", "queued"]);
    fixture.store.create(specification("running", "root"));
    fixture.store.create(specification("queued", "root", "codex", "2099-01-01T00:00:00.000Z"));
    fixture.codex.hold("running");
    fixture.queue.start();
    await waitFor(() => fixture.store.require("running").status === "running");

    const cancelled = await fixture.queue.cancel("queued");
    const repeated = await fixture.queue.cancel("queued");

    expect(cancelled.status).toBe("cancelled");
    expect(repeated).toEqual(cancelled);
    expect(fixture.codex.started).toEqual(["running"]);
    expect(fixture.terminal).toContainEqual(expect.objectContaining({ id: "queued", status: "cancelled" }));
    expect(fixture.terminal.filter(({ id }) => id === "queued")).toHaveLength(1);
    expect(fixture.store.events("queued").entries.filter(({ terminal }) => terminal)).toHaveLength(1);
    fixture.codex.release("running");
    await waitFor(() => fixture.store.require("running").status === "succeeded");
    expect(fixture.codex.started).not.toContain("queued");
    await fixture.close();
  });

  it("aborts and persists cancellation for running work", async () => {
    const fixture = await createFixture();
    fixture.insertRoot("root", ["running"]);
    fixture.store.create(specification("running", "root"));
    fixture.codex.hold("running");
    fixture.queue.start();
    await waitFor(() => fixture.store.require("running").status === "running");

    await fixture.queue.cancel("running");
    await waitFor(() => fixture.store.require("running").status === "cancelled");

    expect(fixture.codex.cancelled).toContain("running");
    expect(fixture.store.require("running")).toMatchObject({
      status: "cancelled",
      cancelRequestedAt: expect.any(String)
    });
    expect(fixture.store.events("running").entries.at(-1)).toMatchObject({
      kind: "warn",
      terminal: true,
      message: "Execution cancelled."
    });
    await fixture.close();
  });
});

describe("LocalExecutionQueue outcomes and recovery", () => {
  it("fails interrupted running work at startup and resumes only queued work", async () => {
    const fixture = await createFixture();
    fixture.insertRoot("root", ["interrupted", "queued"]);
    fixture.store.create(specification("interrupted", "root"));
    fixture.store.claim("interrupted");
    fixture.store.create(specification("queued", "root", "codex", "2026-01-01T00:00:00.001Z"));

    fixture.queue.start();
    await waitFor(() => fixture.store.require("queued").status === "succeeded");

    expect(fixture.store.require("interrupted")).toMatchObject({ status: "failed", errorCode: "interrupted" });
    expect(fixture.codex.started).toEqual(["queued"]);
    expect(fixture.terminal).toContainEqual(expect.objectContaining({ id: "interrupted", status: "failed" }));
    await fixture.close();
  });

  it("rejects a provider completion without a valid structured outcome", async () => {
    const fixture = await createFixture({ validOutcome: false });
    fixture.insertRoot("root", ["invalid"]);
    fixture.store.create(specification("invalid", "root"));

    fixture.queue.start();
    await waitFor(() => fixture.store.require("invalid").status === "failed");

    expect(fixture.store.require("invalid")).toMatchObject({
      errorCode: "execution_failed",
      errorMessage: expect.stringMatching(/structured (Step )?outcome/i)
    });
    expect(fixture.store.events("invalid").entries.at(-1)).toMatchObject({ kind: "error", terminal: true });
    await fixture.close();
  });

  it("derives the provider output schema from the outcome validator", async () => {
    const fixture = await createFixture();
    fixture.insertRoot("root", ["schema"]);
    const spec = specification("schema", "root");
    fixture.store.create(spec);

    await fixture.queue.start();
    await waitFor(() => fixture.store.require("schema").status === "succeeded");

    expect(fixture.codex.outputSchemas[0]).toEqual(z.toJSONSchema(stepOutcomeSchema));
    expect(fixture.codex.prompts.get(spec.taskId)).toBe(spec.evidence.prompt);
    await fixture.close();
  });

  it("clears its shutdown timeout after workers stop", async () => {
    vi.useFakeTimers();
    try {
      const fixture = await createFixture();
      await fixture.queue.shutdown();
      expect(vi.getTimerCount()).toBe(0);
      await fixture.close();
    } finally {
      vi.useRealTimers();
    }
  });
});
