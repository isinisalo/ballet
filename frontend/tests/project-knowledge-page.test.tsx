// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import type { AppData } from "../../backend/shared/domain";
import { ProjectKnowledgePage } from "../src/features/project-knowledge/ProjectKnowledgePage";

const data = {
  projects: [], goals: [], agents: [], skills: [], runtimes: [], contracts: [], operations: [], policies: [], emissionPolicies: [], loopDefinitions: [], loopInstances: [], eventDefinitions: [], events: [], agentRuns: [],
  adrs: [{ id: "adr-010", projectId: "ballet", title: "JWT-based API authentication", context: "Context.", decision: "Use JWT.", consequences: "Token rotation.", status: "accepted", createdAt: "2026-06-06", updatedAt: "2026-06-06", frontmatter: { owner: "@sys-arch-01", status: "accepted", date: "2026-06-06" }, body: "## Status\n\nAccepted.\n\n## Decision\n\nUse JWT." }]
} satisfies AppData;

afterEach(() => cleanup());

describe("ProjectKnowledgePage", () => {
  it("renders ADR metadata, markdown preview, search filtering, and split edit mode", async () => {
    const user = userEvent.setup();
    render(<ProjectKnowledgePage data={data} />);

    expect(screen.getByRole("heading", { name: "Project Knowledge" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "JWT-based API authentication" })).toBeVisible();
    expect(screen.getByText("@sys-arch-01")).toBeVisible();
    expect(screen.getByText("Use JWT.")).toBeVisible();

    await user.type(screen.getByLabelText("Search documents"), "JWT");
    expect(screen.getAllByText("JWT-based API authentication")[0]).toBeVisible();
    await user.click(screen.getByRole("button", { name: /split edit/i }));
    expect(screen.getByLabelText("Document editor")).toBeVisible();
  });
});
