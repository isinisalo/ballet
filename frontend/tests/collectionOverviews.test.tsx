import type { MarkdownDocument, ProjectInstruction, Skill } from "@shared/api/workspace-contracts";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DocumentCollectionOverview } from "../src/workspace/documents/DocumentCollectionOverview";
import { SkillsOverview } from "../src/workspace/skills/SkillsOverview";

const skill: Skill = {
  id: "project:review",
  projectId: "review",
  name: "Review",
  description: "Reviews changes.",
  metadata: { owner: "quality" },
  origin: "project",
  valid: true,
  sourceSha256: "source",
  contentSha256: "content",
  sizeBytes: 16,
  body: "Review changes.",
  relativePath: ".agents/skills/review/SKILL.md"
};

const documentDirectory = { adr: "adr", goal: "goals", instruction: "instructions" } as const;

const document = (collection: "adr" | "goal" | "instruction"): MarkdownDocument => ({
  id: `${collection}-001`,
  collection: "project",
  title: `${collection} title`,
  frontmatter: {
    title: `${collection} title`,
    status: "accepted",
    updated_date: "2026-07-13",
    tags: [collection, "technical"]
  },
  body: "",
  absolutePath: `/workspace/.ballet/${documentDirectory[collection]}/${collection}-001.md`,
  relativePath: `.ballet/${documentDirectory[collection]}/${collection}-001.md`,
  slug: `${collection}-001`
});

const instructionResource = (source: MarkdownDocument): ProjectInstruction => ({
  id: `project:${source.id}`,
  projectId: source.id,
  title: source.title!,
  body: source.body,
  relativePath: source.relativePath,
  origin: "project",
  valid: true,
  sourceSha256: "source",
  contentSha256: "content",
  sizeBytes: 0
});

describe("collection overviews", () => {
  it("renders skill metadata and keeps an empty collection actionable", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    const { rerender } = render(<SkillsOverview skills={[skill]} navigate={navigate} />);

    expect(screen.getByText("Valid")).toBeInTheDocument();
    expect(screen.getByText("path: .agents/skills/review/SKILL.md")).toBeInTheDocument();
    expect(screen.getByText("project ID: project:review")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open skill Review" }));
    expect(navigate).toHaveBeenCalledWith("/skills?path=.agents%2Fskills%2Freview%2FSKILL.md");

    rerender(<SkillsOverview skills={[]} navigate={navigate} />);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Add skill" }));
    expect(navigate).toHaveBeenCalledWith("/skills?new=1");
  });

  it.each([
    { kind: "adr" as const, label: "ADR", addLabel: "Add ADR", addPath: "/project/adrs?new=1", routeSegment: "adrs" },
    { kind: "goal" as const, label: "Goals", addLabel: "Add goal", addPath: "/project/goals?new=1", routeSegment: "goals" },
    { kind: "instruction" as const, label: "Instructions", addLabel: "Add instruction", addPath: "/project/instructions?new=1", routeSegment: "instructions" }
  ])("renders $label cards and creation navigation", async ({ kind, label, addLabel, addPath, routeSegment }) => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    const source = document(kind);
    render(<DocumentCollectionOverview
      kind={kind}
      documents={[source]}
      instructions={kind === "instruction" ? [instructionResource(source)] : []}
      navigate={navigate}
    />);

    const buttons = within(screen.getByLabelText(label)).getAllByRole("button");
    expect(buttons[0]).toHaveAccessibleName(addLabel);
    expect(screen.getByText(kind === "instruction" ? "Valid" : "accepted")).toBeInTheDocument();
    expect(screen.getByText("updated: 2026-07-13")).toBeInTheDocument();
    expect(screen.getByText(`tags: ${kind}, technical`)).toBeInTheDocument();

    await user.click(buttons[0]);
    expect(navigate).toHaveBeenCalledWith(addPath);
    await user.click(screen.getByRole("button", { name: `Open ${kind} ${kind} title` }));
    expect(navigate).toHaveBeenCalledWith(`/project/${routeSegment}?path=.ballet%2F${documentDirectory[kind]}%2F${kind}-001.md`);
  });
});
