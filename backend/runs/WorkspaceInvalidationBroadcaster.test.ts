import { describe, expect, it, vi } from "vitest";
import { workspaceInvalidationEventSchema } from "../../shared/api/runtime-schemas.js";
import { WorkspaceInvalidationBroadcaster } from "./WorkspaceInvalidationBroadcaster.js";

const rootRunId = "10000000-0000-4000-8000-000000000001";

describe("WorkspaceInvalidationBroadcaster", () => {
  it("publishes strict state-aware Run invalidations and replays them", () => {
    const broadcaster = new WorkspaceInvalidationBroadcaster();
    const listener = vi.fn();
    const unsubscribe = broadcaster.subscribe(listener);

    const event = broadcaster.publish({
      type: "runs-changed",
      rootRunId,
      stateRevision: 3,
      status: "waiting_for_input"
    });

    expect(workspaceInvalidationEventSchema.parse(event)).toEqual(event);
    expect(listener).toHaveBeenCalledWith(event);
    expect(broadcaster.replay(0)).toEqual({ events: [event], reset: false });
    unsubscribe();
  });

  it("emits a schema-valid reset instead of an untyped reconnect payload", () => {
    const broadcaster = new WorkspaceInvalidationBroadcaster(1);
    broadcaster.publish({ type: "workspace-changed", reason: "first" });
    broadcaster.publish({ type: "workspace-changed", reason: "second" });

    expect(broadcaster.replay(0).reset).toBe(true);
    expect(workspaceInvalidationEventSchema.parse(broadcaster.resetEvent())).toMatchObject({
      id: 2,
      type: "workspace-changed",
      reason: "reconnected"
    });
  });

  it("rejects incomplete or provider-controlled Run invalidation fields", () => {
    expect(workspaceInvalidationEventSchema.safeParse({
      id: 1,
      type: "runs-changed",
      at: "2026-01-01T00:00:00.000Z",
      rootRunId,
      rawRoute: "target-from-agent"
    }).success).toBe(false);
  });
});
