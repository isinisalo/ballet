import type {
  ExecutionProfile,
  ProjectAgentStep,
  ProjectInstruction,
  ProjectLoop,
  ProjectLoopNode,
  Skill
} from "@shared/api/workspace-contracts";
import { defaultTerminalNodes } from "@shared/api/workspace-contracts";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { LoopNodeSheetEditor } from "../src/workspace/automation/loops/LoopStepSheetEditor";
import { StepCompositionPreview } from "../src/workspace/automation/loops/StepCompositionPreview";
import { StepSkillsField } from "../src/workspace/automation/loops/StepSkillsField";
import { localRuntime } from "./runtimeFixtures";

const profile: ExecutionProfile = {
  id: "primary",
  name: "Primary",
  provider: "codex",
  model: "gpt-test",
  reasoningEffort: "high",
  networkAccess: false
};

const instruction: ProjectInstruction = {
  id: "project:primary",
  projectId: "primary",
  title: "Primary instruction",
  origin: "project",
  valid: true,
  sourceSha256: "source",
  contentSha256: "content",
  sizeBytes: 24,
  body: "Follow the primary instruction.",
  relativePath: ".ballet/instructions/primary.md"
};

const skill = (id: string, name: string, valid = true): Skill => ({
  id: `project:${id}`,
  projectId: id,
  name,
  description: `${name} skill`,
  metadata: {},
  origin: "project",
  valid,
  sourceSha256: `${id}-source`,
  contentSha256: `${id}-content`,
  sizeBytes: 16,
  body: `Apply ${name}.`,
  relativePath: `.agents/skills/${id}/SKILL.md`
});

const skills = [skill("alpha", "Alpha"), skill("zeta", "Zeta")];

const work: ProjectAgentStep = {
  id: "work",
  type: "agent",
  executionProfileId: profile.id,
  primaryInstructionId: instruction.id!,
  skillIds: [skills[1]!.id, skills[0]!.id],
  description: "Complete the work.",
  nodeStyle: "sol",
  nodeSize: "large",
  on: { approved: "review", rejected: "failed" }
};

const review: ProjectLoopNode = {
  id: "review",
  type: "human",
  description: "Review the work.",
  nodeStyle: "luna",
  nodeSize: "tiny",
  on: { approved: "completed", rejected: "blocked" }
};

const loop: ProjectLoop = {
  id: "delivery",
  start: work.id,
  nodes: [work, review, ...defaultTerminalNodes()]
};

const nextLoop: ProjectLoop = {
  id: "follow-up",
  start: "decide",
  nodes: [{
    id: "decide",
    type: "human",
    description: "Continue?",
    nodeStyle: "flat",
    nodeSize: "medium",
    on: { approved: "completed", rejected: "blocked" }
  }, ...defaultTerminalNodes()]
};

const renderNode = (step: ProjectLoopNode, overrides: Partial<React.ComponentProps<typeof LoopNodeSheetEditor>> = {}) => {
  const onChange = vi.fn();
  render(<LoopNodeSheetEditor
    step={step}
    loop={loop}
    loops={[loop, nextLoop]}
    executionProfiles={[profile]}
    instructions={[instruction]}
    skills={skills}
    runtime={localRuntime()}
    disabled={false}
    onChange={onChange}
    onRemove={vi.fn()}
    surface="embedded"
    {...overrides}
  />);
  return onChange;
};

describe("Loop node composition editor", () => {
  it("keeps the Agent Step task, composition, and two transitions in the primary flow", () => {
    renderNode(work);
    const form = screen.getByRole("form", { name: "Node editor" });
    const fields = [
      within(form).getByLabelText("Task description"),
      within(form).getByRole("combobox", { name: "Execution profile" }),
      within(form).getByRole("combobox", { name: "Primary instruction" }),
      within(form).getByRole("button", { name: "Skills" }),
      within(form).getByRole("combobox", { name: "Approved target" }),
      within(form).getByRole("combobox", { name: "Rejected target" })
    ];
    for (let index = 1; index < fields.length; index += 1) {
      expect(fields[index - 1]!.compareDocumentPosition(fields[index]!))
        .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    }
    expect(fields[1]).toHaveClass("min-w-0");
    expect(fields[2]).toHaveClass("min-w-0");

    expect(screen.getByRole("button", { name: "Appearance" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Advanced" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("Node ID")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Network access")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Model")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Reasoning effort")).not.toBeInTheDocument();
  });

  it("shows required composition failures adjacent to the missing fields", () => {
    renderNode({
      ...work,
      executionProfileId: "",
      primaryInstructionId: "",
      skillIds: ["project:missing"]
    });

    expect(screen.getByText("Select an execution profile.")).toBeInTheDocument();
    expect(screen.getByText("Select one primary instruction.")).toBeInTheDocument();
    expect(screen.getByText("Missing or invalid skills: project:missing.")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Execution profile" })).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("combobox", { name: "Primary instruction" })).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: "Skills" })).toHaveAttribute("aria-invalid", "true");
  });

  it("uses one grouped target picker for each persisted result", async () => {
    const user = userEvent.setup();
    const onChange = renderNode(work);
    const form = screen.getByRole("form", { name: "Node editor" });
    expect(form.querySelectorAll("[data-loop-transition-result]")).toHaveLength(2);

    await user.click(within(form).getByRole("combobox", { name: "Approved target" }));
    const listbox = await screen.findByRole("listbox");
    for (const group of ["Node", "Loop", "End Loop"]) expect(within(listbox).getByText(group)).toBeInTheDocument();
    await user.click(within(listbox).getByRole("option", { name: nextLoop.id }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      on: { approved: { loop: nextLoop.id }, rejected: "failed" }
    }));
  });

  it("omits composition for Human Steps and all transition controls for terminals", async () => {
    const { rerender } = render(<LoopNodeSheetEditor
      step={review}
      loop={loop}
      loops={[loop, nextLoop]}
      executionProfiles={[profile]}
      instructions={[instruction]}
      skills={skills}
      runtime={localRuntime()}
      disabled={false}
      onChange={vi.fn()}
      onRemove={vi.fn()}
      surface="embedded"
    />);
    expect(screen.queryByRole("combobox", { name: "Execution profile" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Approved target" })).toBeInTheDocument();

    rerender(<LoopNodeSheetEditor
      step={defaultTerminalNodes()[0]!}
      loop={loop}
      loops={[loop, nextLoop]}
      executionProfiles={[profile]}
      instructions={[instruction]}
      skills={skills}
      runtime={localRuntime()}
      disabled={false}
      onChange={vi.fn()}
      onRemove={vi.fn()}
      surface="embedded"
    />);
    expect(screen.getByText("Terminal nodes have no transitions.")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Approved target" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Rejected target" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Execution profile" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove from loop" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Node ID")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Advanced" }));
    expect(screen.getByLabelText("Node ID")).toBeDisabled();
  });
});

describe("Step skill selection", () => {
  function Harness() {
    const [skillIds, setSkillIds] = useState<string[]>([]);
    return <StepSkillsField skillIds={skillIds} skills={skills} disabled={false} onChange={setSkillIds} />;
  }

  it("supports keyboard selection and renders removable canonical chips", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Skills" });

    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const alpha = await screen.findByRole("option", { name: /Alpha/ });
    await waitFor(() => expect(alpha).toHaveFocus());
    await user.keyboard("[Enter][End][Space][Escape]");

    const selected = await screen.findByLabelText("Selected skills");
    expect(within(selected).getAllByText(/Alpha|Zeta/).map((node) => node.textContent)).toEqual(["Alpha", "Zeta"]);
    expect(screen.getByRole("button", { name: "Skills" })).toHaveFocus();
    await user.click(within(selected).getByRole("button", { name: "Remove Alpha skill" }));
    expect(screen.queryByRole("button", { name: "Remove Alpha skill" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Zeta skill" })).toBeInTheDocument();
  });

  it("closes the skills listbox when keyboard focus leaves the control", async () => {
    const user = userEvent.setup();
    render(<><Harness /><button type="button">Next field</button></>);
    await user.click(screen.getByRole("button", { name: "Skills" }));
    expect(screen.getByRole("listbox", { name: "Skills" })).toBeInTheDocument();

    await user.tab();
    expect(screen.queryByRole("listbox", { name: "Skills" })).not.toBeInTheDocument();
  });
});

describe("Step composition preview", () => {
  it("shows deterministic authority order and canonical selected resources", () => {
    render(<StepCompositionPreview step={work} profiles={[profile]} instructions={[instruction]} skills={skills} runtime={localRuntime()} />);
    const preview = screen.getByRole("complementary", { name: "Step composition preview" });
    expect(within(preview).getByText("Valid")).toBeInTheDocument();
    expect(within(preview).getByText("System → Primary → Skills → Task → Schema")).toBeInTheDocument();
    const alpha = within(preview).getByRole("heading", { name: "Alpha" });
    const zeta = within(preview).getByRole("heading", { name: "Zeta" });
    expect(alpha.compareDocumentPosition(zeta)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("marks an unavailable profile composition invalid", () => {
    render(<StepCompositionPreview
      step={work}
      profiles={[profile]}
      instructions={[instruction]}
      skills={skills}
      runtime={localRuntime({ providers: [] })}
    />);

    expect(screen.getByText("Invalid")).toBeInTheDocument();
  });

  it("marks an empty task composition invalid even when every resource is available", () => {
    render(<StepCompositionPreview
      step={{ ...work, description: " \n" }}
      profiles={[profile]}
      instructions={[instruction]}
      skills={skills}
      runtime={localRuntime()}
    />);

    expect(screen.getByText("Invalid")).toBeInTheDocument();
  });

  it.each([
    [review, "Human Steps have no execution composition."],
    [defaultTerminalNodes()[0]!, "Terminal nodes have no execution composition."]
  ] as const)("discloses non-execution composition", (step, message) => {
    render(<StepCompositionPreview step={step} profiles={[profile]} instructions={[instruction]} skills={skills} />);
    expect(screen.getByText(message)).toBeInTheDocument();
  });
});
