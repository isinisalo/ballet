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
    executionProfiles: [{
      id: "profile-a",
      name: "Profile A",
      provider: "codex" as const,
      model: "gpt-test",
      reasoningEffort: "medium",
      networkAccess: false
    }],
    skills: [
      {
        id: "project:skill-a",
        projectId: "skill-a",
        name: "Skill A",
        description: "",
        relativePath: ".agents/skills/a/SKILL.md",
        origin: "project" as const,
        valid: true,
        sourceSha256: "source",
        contentSha256: "content",
        sizeBytes: 0,
        metadata: {},
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

  it("selects ExecutionProfiles by id and Skills by project path", () => {
    expect(getWorkspaceSelection({
      data,
      route: { view: "execution-profiles" }
    }).selectedExecutionProfile).toBeUndefined();

    expect(getWorkspaceSelection({
      data,
      route: { view: "execution-profiles", executionProfileId: "profile-a" }
    }).selectedExecutionProfile?.id).toBe("profile-a");

    expect(getWorkspaceSelection({
      data,
      route: { view: "execution-profiles", executionProfileId: "missing" }
    }).selectedExecutionProfile).toBeUndefined();

    expect(getWorkspaceSelection({
      data,
      route: { view: "skills", documentPath: ".agents/skills/a/SKILL.md" }
    }).selectedSkill?.id).toBe("project:skill-a");
  });
});
