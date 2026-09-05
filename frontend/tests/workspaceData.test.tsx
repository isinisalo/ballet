import { renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ApiRequestError } from "../src/apiClient";
import { orchestrationApi } from "../src/orchestration/orchestrationApi";
import { useOrchestrationGovernanceData } from "../src/orchestration/useOrchestrationGovernanceData";

function lists() {
  for (const key of ["runs", "feedback", "criticProposals", "refinementProposals"] as const) vi.spyOn(orchestrationApi, key).mockResolvedValue([]);
}
it("does not load governance data in an authoring workspace", async () => {
  lists();
  const { result } = renderHook(() => useOrchestrationGovernanceData({ view: "orchestration", workspaceView: "skills" }));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(orchestrationApi.runs).not.toHaveBeenCalled();
  expect(orchestrationApi.criticProposals).not.toHaveBeenCalled();
});
it("loads only Critic data on the Critic list", async () => {
  lists();
  const { result } = renderHook(() => useOrchestrationGovernanceData({ view: "orchestration", workspaceView: "critic-reviews" }));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(orchestrationApi.criticProposals).toHaveBeenCalledOnce();
  expect(orchestrationApi.feedback).not.toHaveBeenCalled();
  expect(orchestrationApi.runs).not.toHaveBeenCalled();
});
it.each([404, 500])("distinguishes detail HTTP %s from a missing Run", async (status) => {
  lists(); vi.spyOn(orchestrationApi, "run").mockRejectedValue(new ApiRequestError("Database unavailable", status));
  const { result } = renderHook(() => useOrchestrationGovernanceData({ view: "orchestration", workspaceView: "run-detail", entityId: "run-1" }));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toBe(status === 500 ? "Database unavailable" : undefined);
});

import { useOrchestrationConfigureData } from "../src/orchestration/useOrchestrationConfigureData";
import { orchestrationConfig } from "./orchestrationFixtures";
it("loads no Markdown collections or governance Agents for Loop Engineering", async () => {
  const config = orchestrationConfig();
  vi.spyOn(orchestrationApi, "project").mockResolvedValue({ config, configHash: "hash", path: "project" });
  vi.spyOn(orchestrationApi, "environment").mockResolvedValue({ environment: config.environment, configHash: "hash", activeRunIds: [], locked: false, readinessIssues: [] });
  const resources = vi.spyOn(orchestrationApi, "resources");
  const references = vi.spyOn(orchestrationApi, "references");
  const agents = vi.spyOn(orchestrationApi, "agents");
  const { result } = renderHook(() => useOrchestrationConfigureData({ view: "orchestration", workspaceView: "environment" }));
  await waitFor(() => expect(result.current.data).toBeDefined());
  expect(resources).not.toHaveBeenCalled(); expect(agents).not.toHaveBeenCalled(); expect(references).not.toHaveBeenCalled();
});
