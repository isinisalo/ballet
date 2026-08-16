import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { NodeRun } from "../../shared/api/workspace-contracts.js";
import { NodeRunResponsePanel } from "../src/workspace/automation/loops/NodeRunResponsePanel.js";
import {
  buildHumanValidationResponse,
  buildHumanWorkResponse
} from "../src/workspace/automation/loops/humanNodeResponse.js";

describe("role-specific Human Node responses", () => {
  it("builds strict Work and Validation outcomes without a shared decision field", () => {
    const work = buildHumanWorkResponse({
      state: "completed", summary: "Implemented.", artifacts: "{}", checks: "[]", statePatch: ""
    });
    expect(work).toEqual({ kind: "work", outcome: {
      role: "work", state: "completed", summary: "Implemented.", artifacts: {}, checks: []
    } });
    expect(work.outcome).not.toHaveProperty("decision");

    const validation = buildHumanValidationResponse({
      state: "FAIL", summary: "Missing check.", evidence: "{}", checks: "[]", statePatch: "",
      repairMode: "LOCAL_RETRY", feedback: "Add the check.", expectedCorrection: "Check passes.",
      reason: "", requestedCapability: "", evidenceRefs: "[]"
    });
    expect(validation).toMatchObject({ kind: "validation", outcome: {
      role: "validation", state: "completed", decision: "FAIL",
      repair: { mode: "LOCAL_RETRY", feedback: "Add the check." }
    } });
  });

  it("renders labeled Human Work fields and submits only a Work response", async () => {
    const user = userEvent.setup();
    const onRespond = vi.fn(async () => true);
    render(<NodeRunResponsePanel node={node("work")} pending={false} onRespond={onRespond} />);

    expect(screen.getByRole("form", { name: "Human Work response" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Summary"), "Completed by operator.");
    await user.click(screen.getByRole("button", { name: "Submit Work outcome" }));
    expect(onRespond).toHaveBeenCalledWith(expect.objectContaining({ kind: "work" }));
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
  workLoopNodeRunId: role === "orchestrator" ? undefined : "composite", role,
  loopId: "main", workLoopNodeId: role === "orchestrator" ? undefined : "work",
  nodeDefinitionId: role === "orchestrator" ? "project:orchestrator" : `main:work:${role}`,
  status: "waiting_for_input", attempt: 1, stateRevisionBefore: 0,
  createdAt: timestamp, updatedAt: timestamp
});
