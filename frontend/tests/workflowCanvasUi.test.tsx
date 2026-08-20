import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LoopCanvas } from "../src/workspace/automation/loops/LoopCanvas";
import { workflowAutomation, workflowLoop } from "./workflowFixtures";

describe("Workflow Engineering canvas", () => {
  it("projects paired Validation inside the selectable Job artwork without endpoint nodes", async () => {
    const user = userEvent.setup();
    const loop = workflowLoop();
    const onSelection = vi.fn();
    const { container } = render(
      <LoopCanvas
        config={workflowAutomation(loop)}
        loop={loop}
        executionProfiles={[{
          id: "codex-test", name: "Codex high", provider: "codex", model: "gpt-test",
          reasoningEffort: "high", networkAccess: false
        }]}
        onSelection={onSelection}
      />
    );

    const job = screen.getByRole("button", { name: "Edit Job Node job, includes Validation job-validation" });
    await user.click(job);
    expect(onSelection).toHaveBeenLastCalledWith({ kind: "job", id: "job" });
    job.focus();
    await user.keyboard("{Enter}");
    expect(onSelection).toHaveBeenLastCalledWith({ kind: "job", id: "job" });
    expect(container).not.toHaveTextContent("validate");
    expect(container).not.toHaveTextContent("retry");
    expect(container.querySelector("[data-loop-node-artwork='terra']")).toBeInTheDocument();
    expect(container.querySelector("[data-loop-node-artwork='luna']")).not.toBeInTheDocument();
    expect(job).toHaveAttribute("data-loop-node-size", "medium");
    expect(job).toHaveAttribute("data-paired-validation-id", "job-validation");
    expect(container.querySelectorAll("[data-workflow-node='job']")).toHaveLength(1);
    expect(container.querySelector("[data-workflow-node='validation']")).not.toBeInTheDocument();
    expect(container.querySelector("[data-workflow-endpoint]")).not.toBeInTheDocument();
    expect(container.querySelectorAll(".workflow-connection-point").length).toBeGreaterThanOrEqual(2);
  });

  it("keeps PassEdge and FailEdge keyboard-focusable with text and icon semantics", async () => {
    const user = userEvent.setup();
    const loop = workflowLoop();
    const onSelection = vi.fn();
    render(<LoopCanvas config={workflowAutomation(loop)} loop={loop} onSelection={onSelection} />);

    const pass = screen.getByRole("button", { name: /Edit Pass Edge .* to Workflow PASS/ });
    pass.focus();
    await user.keyboard("{Enter}");
    expect(onSelection).toHaveBeenLastCalledWith({ kind: "pass-edge", id: loop.workflow.passEdges[0]!.id });
    const fail = screen.getByRole("button", { name: /Edit Fail Edge .* to Workflow FAIL and external escalation/ });
    fail.focus();
    await user.keyboard(" ");
    expect(onSelection).toHaveBeenLastCalledWith({ kind: "fail-edge", id: loop.workflow.failEdges[0]!.id });
    expect(pass).toHaveTextContent("✓ PASS");
    expect(fail).toHaveTextContent("✕ FAIL · escalate");
  });

  it("uses only straight and smart smoothstep geometry for persisted Workflow edges", () => {
    const loop = workflowLoop();
    const firstJob = loop.workflow.jobNodes[0]!;
    loop.workflow.jobNodes.push({
      ...firstJob,
      id: "job-2",
      validationNodeId: "job-2-validation"
    });
    loop.workflow.validationNodes.push({
      ...loop.workflow.validationNodes[0]!,
      id: "job-2-validation"
    });
    loop.workflow.passEdges[0] = {
      ...loop.workflow.passEdges[0]!,
      target: { jobNodeId: "job-2" }
    };
    loop.workflow.passEdges.push({
      id: "job-2-pass",
      sourceValidationNodeId: "job-2-validation",
      target: { workflowResult: "PASS" }
    });
    loop.workflow.failEdges.push({
      id: "job-2-fail",
      sourceValidationNodeId: "job-2-validation",
      target: { workflowResult: "FAIL" }
    });

    const { container } = render(<LoopCanvas config={workflowAutomation(loop)} loop={loop} />);
    const edgePaths = [...container.querySelectorAll<SVGPathElement>("[data-workflow-edge]")];
    expect(edgePaths).toHaveLength(4);
    expect(edgePaths.map((path) => path.dataset.edgeGeometry)).toEqual([
      "straight", "smoothstep", "smoothstep", "smoothstep"
    ]);
    expect(edgePaths.every((path) => ["straight", "smoothstep"].includes(path.dataset.edgeGeometry ?? ""))).toBe(true);
    expect(edgePaths.every((path) => path.getAttribute("stroke-dasharray") === null)).toBe(true);
  });

  it("offers atomic first-pair creation on an empty Workflow", async () => {
    const user = userEvent.setup();
    const loop = workflowLoop();
    loop.workflow = { startJobNodeId: "job", jobNodes: [], validationNodes: [], passEdges: [], failEdges: [] };
    const onAddFirstNode = vi.fn();
    render(<LoopCanvas config={workflowAutomation(loop)} loop={loop} onAddFirstNode={onAddFirstNode} />);
    await user.click(screen.getByRole("button", { name: "Add first Job" }));
    expect(onAddFirstNode).toHaveBeenCalledOnce();
  });
});
