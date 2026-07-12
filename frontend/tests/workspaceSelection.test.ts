import { describe, expect, it } from "vitest";
import type { MarkdownDocument, ProjectDocumentTreeNode } from "@shared/api/workspace-contracts";
import { emptyData } from "../src/workspace/types";
import { getWorkspaceSelection } from "../src/workspace/selection/useWorkspaceSelection";

const document = (id: string, relativePath: string): MarkdownDocument => ({
  id,
  collection: "goals",
  absolutePath: `/workspace/${relativePath}`,
  relativePath,
  slug: id,
  frontmatter: { title: id },
  body: `${id} body`
});

describe("workspace selection", () => {
  const firstGoal = document("first-goal", ".ballet/goals/first.md");
  const secondGoal = document("second-goal", ".ballet/goals/second.md");
  const adr = document("first-adr", ".ballet/adr/decision.md");
  const tree: ProjectDocumentTreeNode[] = [
    {
      type: "directory",
      label: "goals",
      relativePath: ".ballet/goals",
      children: [
        { type: "file", label: "First goal", document: firstGoal },
        { type: "file", label: "Second goal", document: secondGoal }
      ]
    },
    {
      type: "directory",
      label: "adr",
      relativePath: ".ballet/adr",
      children: [
        { type: "file", label: "Decision", document: adr }
      ]
    }
  ];

  const data = {
    ...emptyData,
    project: {
      id: "project-a",
      name: "Project A",
      description: "Local checkout",
      status: "active" as const,
      createdAt: "2026-07-11T10:00:00.000Z",
      updatedAt: "2026-07-11T10:00:00.000Z",
      relativePath: ".ballet/project.md",
      frontmatter: { title: "Project A" },
      body: "Project A"
    },
    agents: [
      {
        id: "agent-a",
        name: "Agent A",
        description: "",
        runtime: "codex",
        enabled: true,
        path: ".codex/agents/a.toml",
        relativePath: ".codex/agents/a.toml",
        config: {},
        skills: [],
        frontmatter: {},
        body: ""
      }
    ],
    skills: [
      {
        id: "skill-a",
        name: "Skill A",
        description: "",
        path: ".agents/skills/a/SKILL.md",
        relativePath: ".agents/skills/a/SKILL.md",
        frontmatter: { name: "Skill A" },
        body: ""
      }
    ],
    projectDocumentTree: tree
  };

  it("uses the single project and selects documents only from its tree", () => {
    const routed = getWorkspaceSelection({
      data,
      route: { view: "project-goals", documentPath: ".ballet/goals/second.md" }
    });

    expect(routed.project?.id).toBe("project-a");
    expect(routed.selectedGoal?.id).toBe("second-goal");

    const fallback = getWorkspaceSelection({
      data,
      route: { view: "project-goals", documentPath: ".ballet/adr/decision.md" }
    });

    expect(fallback.project?.id).toBe("project-a");
    expect(fallback.selectedGoal?.id).toBe("first-goal");
  });

  it("preserves agent and skill selected-item behavior", () => {
    expect(getWorkspaceSelection({
      data,
      route: { view: "agents" }
    }).selectedAgent).toBeUndefined();

    expect(getWorkspaceSelection({
      data,
      route: { view: "agents", documentPath: ".codex/agents/missing.toml" }
    }).selectedAgent?.id).toBe("agent-a");

    expect(getWorkspaceSelection({
      data,
      route: { view: "skills", documentPath: ".agents/skills/a/SKILL.md" }
    }).selectedSkill?.id).toBe("skill-a");
  });
});
