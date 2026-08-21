import { afterEach, describe, expect, it, vi } from "vitest";
import type { TkTicket, TkUpsertInput, TkStoreKind } from "./TkTracker.js";
import { TkTracker } from "./TkTracker.js";
import { TrackerOutbox } from "./TrackerOutbox.js";
import { createRuntimeStoreFixture, type RuntimeStoreTestFixture } from "../runtime/RuntimeStore.test-fixture.js";

const fixtures: RuntimeStoreTestFixture[] = [];
afterEach(async () => Promise.all(fixtures.splice(0).map((fixture) => fixture.close())));

describe("TrackerOutbox reconciliation", () => {
  it("writes stable root and Loop intents before applying each operation exactly once", async () => {
    const fixture = await graphFixture();
    const fake = fakeTracker();
    const outbox = new TrackerOutbox(fixture.connection, fake.tracker);

    await expect(outbox.reconcileOrPause(fixture.roots.require("root-run"))).resolves.toBe(true);
    await expect(outbox.reconcileOrPause(fixture.roots.require("root-run"))).resolves.toBe(true);

    expect(fake.upsert).toHaveBeenCalledTimes(2);
    expect(fake.start).toHaveBeenCalledTimes(2);
    expect(fake.externalRefs()).toEqual(["ballet-loop-run:loop-run", "ballet-root:root-run"]);
    expect(rows(fixture, "SELECT status FROM tracker_outbox")).toEqual([
      { status: "applied" }, { status: "applied" }, { status: "applied" }, { status: "applied" }
    ]);
    expect(rows(fixture, "SELECT external_ref FROM tracker_links ORDER BY external_ref")).toEqual([
      { external_ref: "ballet-loop-run:loop-run" }, { external_ref: "ballet-root:root-run" }
    ]);
  });

  it("pauses after a partial external write and reconciles without duplicates after restart", async () => {
    const fixture = await graphFixture();
    const fake = fakeTracker({ failAfterFirstUpsert: true });
    const first = new TrackerOutbox(fixture.connection, fake.tracker);

    await expect(first.reconcileOrPause(fixture.roots.require("root-run"))).resolves.toBe(false);
    expect(fake.externalRefs()).toEqual(["ballet-root:root-run"]);
    expect(fixture.roots.require("root-run")).toMatchObject({
      status: "waiting_for_input", errorCode: "tracker_unavailable"
    });
    expect(rows(fixture, "SELECT status, error_message FROM tracker_outbox ORDER BY rowid")[0])
      .toMatchObject({ status: "pending", error_message: "simulated partial write" });

    fixture.release();
    const reopened = fixture.reopen();
    fake.allowWrites();
    const resumed = new TrackerOutbox(fixture.connection, fake.tracker);
    await expect(resumed.reconcileOrPause(reopened.roots.require("root-run"))).resolves.toBe(true);

    expect(fake.externalRefs()).toEqual(["ballet-loop-run:loop-run", "ballet-root:root-run"]);
    expect(rows(fixture, "SELECT status FROM tracker_outbox WHERE status = 'pending'")).toEqual([]);
    expect(reopened.roots.require("root-run")).toMatchObject({
      status: "running", errorCode: undefined, errorMessage: undefined
    });
  });

  it("records cancellation closure once for both the Loop invocation and Root Run", async () => {
    const fixture = await graphFixture();
    const fake = fakeTracker();
    const outbox = new TrackerOutbox(fixture.connection, fake.tracker);
    await outbox.reconcileOrPause(fixture.roots.require("root-run"));

    fixture.connection().prepare(
      "UPDATE loop_invocations SET status = 'cancelled', updated_at = ?, completed_at = ? WHERE loop_run_id = 'loop-run'"
    ).run("2026-08-21T00:01:00.000Z", "2026-08-21T00:01:00.000Z");
    fixture.roots.setStatus("root-run", "cancelled", { timestamp: "2026-08-21T00:01:00.000Z" });
    await outbox.reconcileOrPause(fixture.roots.require("root-run"));
    await outbox.reconcileOrPause(fixture.roots.require("root-run"));

    expect(fake.close).toHaveBeenCalledTimes(2);
    expect(fake.close.mock.calls.map((call) => call[3]).sort()).toEqual(["tk-1", "tk-2"]);
    expect(rows(fixture, "SELECT action, status FROM tracker_outbox WHERE action = 'close' ORDER BY rowid"))
      .toEqual([{ action: "close", status: "applied" }, { action: "close", status: "applied" }]);
  });
});

const graphFixture = async () => {
  const fixture = await createRuntimeStoreFixture({}, {
    rootKind: "graph",
    transitions: [{
      id: "done", source: "main-loop", decision: "PASS", outcome: "success",
      target: { runResult: "DONE" }, description: "Complete."
    }]
  });
  fixtures.push(fixture);
  fixture.loops.createLoopRun({
    loopRunId: "loop-run", loop: fixture.loop, rootRunId: "root-run", source: "manual"
  });
  return fixture;
};

const rows = (fixture: RuntimeStoreTestFixture, sql: string): unknown[] =>
  fixture.connection().prepare(sql).all();

const fakeTracker = (options: { failAfterFirstUpsert?: boolean } = {}) => {
  const tickets = new Map<string, TkTicket>();
  let fail = options.failAfterFirstUpsert ?? false;
  const upsert = vi.fn(async (
    _worktree: string,
    _config: unknown,
    _store: TkStoreKind,
    input: TkUpsertInput
  ): Promise<TkTicket> => {
    let ticket = tickets.get(input.externalRef);
    if (!ticket) {
      ticket = {
        id: `tk-${tickets.size + 1}`, status: "open", deps: [], links: [],
        created: "2026-08-21T00:00:00Z", type: input.type,
        priority: input.priority ?? 2, "external-ref": input.externalRef,
        ...(input.parentId ? { parent: input.parentId } : {})
      };
      tickets.set(input.externalRef, ticket);
    }
    if (fail) {
      fail = false;
      throw new Error("simulated partial write");
    }
    return ticket;
  });
  const start = vi.fn<TkTracker["start"]>(async () => undefined);
  const close = vi.fn<TkTracker["close"]>(async () => undefined);
  const tracker = { upsert, start, close, reopen: vi.fn(), note: vi.fn() } as unknown as TkTracker;
  return {
    tracker,
    upsert,
    start,
    close,
    allowWrites: () => { fail = false; },
    externalRefs: () => [...tickets.keys()].sort()
  };
};
