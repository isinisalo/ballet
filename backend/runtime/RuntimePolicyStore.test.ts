import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { runtimeSchema } from "../storage/RuntimeSchema.js";
import { RuntimePolicyStore } from "./RuntimePolicyStore.js";

const connections: Database.Database[] = [];
afterEach(() => connections.splice(0).forEach((connection) => connection.close()));

describe("RuntimePolicyStore acceptance ledger", () => {
  it("makes duplicate verification ledger-neutral and preserves immutable IDs and weights", () => {
    const connection = database();
    const store = new RuntimePolicyStore(() => connection);
    store.initializeLedger("run", {
      version: 1,
      entries: [{ obligationId: "goal", weight: 3, status: "pending", evidenceRefs: [] }],
      sha256: "snapshot"
    });
    const verified = store.applyAcceptance("run", "validation-1", {
      verifyObligationIds: ["goal"],
      invalidateObligationIds: [],
      evidenceRefs: ["evidence:first"]
    });
    const duplicate = store.applyAcceptance("run", "validation-2", {
      verifyObligationIds: ["goal"],
      invalidateObligationIds: [],
      evidenceRefs: ["evidence:duplicate"]
    });
    expect(duplicate).toEqual(verified);
    expect(duplicate.entries).toEqual([{
      obligationId: "goal",
      weight: 3,
      status: "verified",
      evidenceRefs: ["evidence:first"],
      updatedByValidationNodeRunId: "validation-1"
    }]);
  });

  it("allows Validation evidence to invalidate verified progress without changing the ledger contract", () => {
    const connection = database();
    const store = new RuntimePolicyStore(() => connection);
    store.initializeLedger("run", {
      version: 1,
      entries: [{ obligationId: "goal", weight: 3, status: "pending", evidenceRefs: [] }],
      sha256: "snapshot"
    });
    store.applyAcceptance("run", "validation-1", {
      verifyObligationIds: ["goal"], invalidateObligationIds: [], evidenceRefs: ["pass"]
    });
    const invalidated = store.applyAcceptance("run", "validation-2", {
      verifyObligationIds: [], invalidateObligationIds: ["goal"], evidenceRefs: ["defect"]
    });
    expect(invalidated.entries[0]).toMatchObject({ obligationId: "goal", weight: 3, status: "invalidated" });
    expect(() => store.applyAcceptance("run", "validation-3", {
      verifyObligationIds: ["unknown"], invalidateObligationIds: [], evidenceRefs: ["spoof"]
    })).toThrow("outside the immutable ledger");
  });
});

const database = () => {
  const connection = new Database(":memory:");
  connections.push(connection);
  connection.pragma("foreign_keys = ON");
  connection.exec(runtimeSchema);
  connection.prepare(`
    INSERT INTO root_runs (
      root_run_id, kind, target_id, source, status, worktree_path, branch, head_sha,
      config_hash, snapshot_hash, execution_snapshot_json, created_at, updated_at
    ) VALUES ('run', 'graph', 'graph', 'manual', 'running', '/tmp', 'branch', 'head',
      'config', 'snapshot', '{}', 'now', 'now')
  `).run();
  return connection;
};
