import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanupQueueFixtures, createFixture, specification, waitFor } from "./LocalExecutionQueue.test-fixture.js";

afterEach(async () => {
  await cleanupQueueFixtures();
});

describe("LocalExecutionQueue", () => {
  it("runs provider FIFO queues one-at-a-time while Codex and Copilot overlap", async () => {
    const fixture = await createFixture();
    fixture.insertRoot("codex-root");
    fixture.insertRoot("copilot-root");
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

  it("cancels queued work without invoking the adapter", async () => {
    const fixture = await createFixture();
    fixture.insertRoot("root");
    fixture.store.create(specification("running", "root"));
    fixture.store.create(specification("queued", "root", "codex", "2099-01-01T00:00:00.000Z"));
    fixture.codex.hold("running");
    fixture.queue.start();
    await waitFor(() => fixture.store.require("running").status === "running");

    const cancelled = await fixture.queue.cancel("queued");

    expect(cancelled.status).toBe("cancelled");
    expect(fixture.codex.started).toEqual(["running"]);
    expect(fixture.terminal).toContainEqual(expect.objectContaining({ id: "queued", status: "cancelled" }));
    fixture.codex.release("running");
    await waitFor(() => fixture.store.require("running").status === "succeeded");
    expect(fixture.codex.started).not.toContain("queued");
    await fixture.close();
  });

  it("aborts and persists cancellation for running work", async () => {
    const fixture = await createFixture();
    fixture.insertRoot("root");
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

  it("fails interrupted running work at startup and resumes only queued work", async () => {
    const fixture = await createFixture();
    fixture.insertRoot("root");
    fixture.store.create(specification("interrupted", "root"));
    fixture.store.start("interrupted");
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
    fixture.insertRoot("root");
    fixture.store.create(specification("invalid", "root"));

    fixture.queue.start();
    await waitFor(() => fixture.store.require("invalid").status === "failed");

    expect(fixture.store.require("invalid")).toMatchObject({
      errorCode: "execution_failed",
      errorMessage: expect.stringMatching(/structured (agent )?outcome/i),
      outcome: { outcome: "failed", failure: { classification: "permanent", code: "execution_failed" } }
    });
    expect(fixture.store.events("invalid").entries.at(-1)).toMatchObject({ kind: "error", terminal: true });
    await fixture.close();
  });

  it("derives the provider output schema from the outcome validator", async () => {
    const fixture = await createFixture();
    fixture.insertRoot("root");
    fixture.store.create(specification("schema", "root"));

    await fixture.queue.start();
    await waitFor(() => fixture.store.require("schema").status === "succeeded");

    expect(fixture.codex.outputSchemas[0]).toMatchObject({
      additionalProperties: false,
      properties: {
        summary: { maxLength: 20_000 },
        checks: { maxItems: 500 }
      }
    });
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

describe("LocalExecutionQueue outcome propagation", () => {
  it("persists an explicitly retryable provider failure as a transient failed outcome", async () => {
    const fixture = await createFixture({
      providerFailure: { message: "Provider is temporarily unavailable.", retryable: true }
    });
    fixture.insertRoot("root");
    fixture.store.create(specification("transient", "root"));

    fixture.queue.start();
    await waitFor(() => fixture.store.require("transient").status === "failed");

    expect(fixture.store.require("transient")).toMatchObject({
      errorCode: "execution_failed",
      errorMessage: "Provider is temporarily unavailable.",
      outcome: {
        outcome: "failed",
        summary: "Provider is temporarily unavailable.",
        failure: { classification: "transient", code: "execution_failed" }
      }
    });
    await fixture.close();
  });

  it("keeps a provider-successful blocked outcome distinct in the terminal event", async () => {
    const fixture = await createFixture({
      structuredOutcome: { outcome: "blocked", summary: "A product decision is required.", checks: [] }
    });
    fixture.insertRoot("root");
    fixture.store.create(specification("blocked", "root"));

    fixture.queue.start();
    await waitFor(() => fixture.store.require("blocked").status === "succeeded");

    expect(fixture.store.require("blocked").outcome?.outcome).toBe("blocked");
    expect(fixture.store.events("blocked").entries.at(-1)).toMatchObject({
      kind: "warn",
      level: "warn",
      message: "Agent outcome: blocked.",
      terminal: true
    });
    await fixture.close();
  });
});
