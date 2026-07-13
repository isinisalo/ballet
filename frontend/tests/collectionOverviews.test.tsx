import type { Agent, MarkdownDocument, Skill } from "@shared/api/workspace-contracts";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AgentsOverview } from "../src/workspace/agents/AgentsOverview";
import { DocumentCollectionOverview } from "../src/workspace/documents/DocumentCollectionOverview";
import { SkillsOverview } from "../src/workspace/skills/SkillsOverview";

const agent: Agent = {
  id: "review-agent",
  name: "Review Agent",
  description: "Reviews implementation changes.",
  instructions: "Review the change.",
  skills: [],
  enabled: true,
  avatar: "search",
  createdAt: "2026-07-13T10:00:00.000Z",
  updatedAt: "2026-07-13T11:00:00.000Z",
  relativePath: ".codex/agents/review-agent.toml"
};

const skill: Skill = {
  id: "review",
  name: "Review",
  description: "Reviews changes.",
  metadata: { owner: "quality" },
  enabled: true,
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

describe("collection overviews", () => {
  it("renders the add card first and opens an agent card with live status metadata", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    render(<AgentsOverview agents={[agent]} executionStates={[{ agentId: agent.id, status: "running" }]} navigate={navigate} />);

    const grid = screen.getByLabelText("Agents");
    const buttons = within(grid).getAllByRole("button");
    expect(buttons[0]).toHaveAccessibleName("Add agent");
    expect(screen.getByText("Reviews implementation changes.")).toBeInTheDocument();
    expect(screen.getByText("running")).toBeInTheDocument();

    await user.click(buttons[0]);
    expect(navigate).toHaveBeenCalledWith("/agents?new=1");
    await user.click(screen.getByRole("button", { name: "Open agent Review Agent" }));
    expect(navigate).toHaveBeenCalledWith("/agents?path=.codex%2Fagents%2Freview-agent.toml");
  });

  it("renders skill metadata and keeps an empty collection actionable", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    const { rerender } = render(<SkillsOverview skills={[skill]} navigate={navigate} />);

    expect(screen.getByText("1 metadata key")).toBeInTheDocument();
    expect(screen.getByText("enabled")).toBeInTheDocument();
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
    render(<DocumentCollectionOverview kind={kind} documents={[source]} navigate={navigate} />);

    const buttons = within(screen.getByLabelText(label)).getAllByRole("button");
    expect(buttons[0]).toHaveAccessibleName(addLabel);
    expect(screen.getByText("accepted")).toBeInTheDocument();
    expect(screen.getByText("updated: 2026-07-13")).toBeInTheDocument();
    expect(screen.getByText(`tags: ${kind}, technical`)).toBeInTheDocument();

    await user.click(buttons[0]);
    expect(navigate).toHaveBeenCalledWith(addPath);
    await user.click(screen.getByRole("button", { name: `Open ${kind} ${kind} title` }));
    expect(navigate).toHaveBeenCalledWith(`/project/${routeSegment}?path=.ballet%2F${documentDirectory[kind]}%2F${kind}-001.md`);
  });
});
