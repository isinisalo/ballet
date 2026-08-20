import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { NodeRun } from "../../shared/api/workspace-contracts.js";
import { NodeRunResponsePanel } from "../src/workspace/automation/loops/NodeRunResponsePanel.js";
import {
  buildHumanValidationResponse,
  buildHumanJobResponse
} from "../src/workspace/automation/loops/humanNodeResponse.js";

describe("role-specific Human Node responses", () => {
  it("builds strict Job and Validation outcomes without a shared decision field", () => {
    const job = buildHumanJobResponse({
      state: "completed", summary: "Implemented.", artifacts: "{}", checks: "[]", statePatch: ""
    });
    expect(job).toEqual({ kind: "job", outcome: {
      role: "job", state: "completed", summary: "Implemented.", artifacts: {}, checks: []
    } });
    expect(job.outcome).not.toHaveProperty("decision");

    const validation = buildHumanValidationResponse({
      state: "FAIL", summary: "Missing check.", evidence: "{}", checks: "[]", statePatch: "",
      feedback: "Add the check.", expectedCorrection: "Check passes.", escalationKind: "capability",
      reason: "A repair capability is required.", requestedCapability: "repair-check", requestedOutcome: "{}", evidenceRefs: "[]"
    });
    expect(validation).toMatchObject({ kind: "validation", outcome: {
      role: "validation", state: "completed", decision: "FAIL",
      feedback: "Add the check.", expectedCorrection: "Check passes.",
      escalation: { requestedCapability: "repair-check" }
    } });
  });

  it("renders labeled Human Job fields and submits only a Job response", async () => {
    const user = userEvent.setup();
    const onRespond = vi.fn(async () => true);
    render(<NodeRunResponsePanel node={node("job")} pending={false} onRespond={onRespond} />);

    expect(screen.getByRole("form", { name: "Human Job response" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Summary"), "Completed by operator.");
    await user.click(screen.getByRole("button", { name: "Submit Job outcome" }));
    expect(onRespond).toHaveBeenCalledWith(expect.objectContaining({ kind: "job" }));
  });

  it("accepts an Orchestrator input response only through resume", async () => {
    const user = userEvent.setup();
    const onRespond = vi.fn(async () => true);
    const orchestrator = {
      ...node("orchestrator"),
      outcome: {
        role: "orchestrator" as const, state: "needs_input" as const, summary: "Need input.",
        question: "Which capability?", context: "Choose one."
      }
    };
    render(<NodeRunResponsePanel node={orchestrator} pending={false} onRespond={onRespond} />);
    await user.type(screen.getByLabelText("Response"), "Use capability A.");
    await user.click(screen.getByRole("button", { name: "Resume" }));
    expect(onRespond).toHaveBeenCalledWith({ kind: "resume", response: "Use capability A." });
  });
});

const timestamp = "2026-01-01T00:00:00.000Z";
const node = (role: NodeRun["role"]): NodeRun => ({
  nodeRunId: `${role}-node`, rootRunId: "root-run", loopRunId: "loop-run",
  jobRunId: role === "orchestrator" ? undefined : "job-run", role,
  loopId: "main", jobNodeId: role === "orchestrator" ? undefined : "job",
  workflowNodeId: role === "orchestrator" ? undefined : role === "job" ? "job" : "job-validation",
  nodeDefinitionId: role === "orchestrator" ? "project:orchestrator" : role === "job" ? "job" : "job-validation",
  status: "waiting_for_input", attempt: 1, stateRevisionBefore: 0,
  createdAt: timestamp, updatedAt: timestamp
});
