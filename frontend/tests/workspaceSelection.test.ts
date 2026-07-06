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
    projects: [
      {
        id: "project-a",
        collection: "projects",
        absolutePath: "/workspace/.ballet/project-a.md",
        relativePath: ".ballet/project-a.md",
        slug: "project-a",
        frontmatter: { title: "Project A" },
        body: "Project A"
      },
      {
        id: "project-b",
        collection: "projects",
        absolutePath: "/workspace/.ballet/project-b.md",
        relativePath: ".ballet/project-b.md",
        slug: "project-b",
        frontmatter: { title: "Project B" },
        body: "Project B"
      }
    ],
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

  it("preserves project and document fallback behavior", () => {
    const routed = getWorkspaceSelection({
      data,
      route: { view: "project-goals", projectId: "project-b", documentPath: ".ballet/goals/second.md" },
      selectedProjectId: "project-a"
    });

    expect(routed.project?.id).toBe("project-b");
    expect(routed.selectedGoal?.id).toBe("second-goal");

    const fallback = getWorkspaceSelection({
      data,
      route: { view: "project-goals", projectId: "missing", documentPath: ".ballet/adr/decision.md" },
      selectedProjectId: "project-a"
    });

    expect(fallback.project?.id).toBe("project-a");
    expect(fallback.selectedGoal?.id).toBe("first-goal");
  });

  it("preserves agent and skill selected-item behavior", () => {
    expect(getWorkspaceSelection({
      data,
      route: { view: "agents" },
      selectedProjectId: "project-a"
    }).selectedAgent).toBeUndefined();

    expect(getWorkspaceSelection({
      data,
      route: { view: "agents", documentPath: ".codex/agents/missing.toml" },
      selectedProjectId: "project-a"
    }).selectedAgent?.id).toBe("agent-a");

    expect(getWorkspaceSelection({
      data,
      route: { view: "skills", documentPath: ".agents/skills/a/SKILL.md" },
      selectedProjectId: "project-a"
    }).selectedSkill?.id).toBe("skill-a");
  });
});
