// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { useState } from "react";
import { EmissionBuilder, defaultResultBranch, type ResultBranchDraft } from "../src/components/emission-builder/EmissionBuilder";

const fields = [
  { name: "subject", label: "Work item", type: "text" as const, required: true },
  { name: "customerId", label: "Customer", type: "text" as const, required: true }
];

const resultFields = [
  { name: "decision", label: "Decision", type: "text" as const },
  { name: "score", label: "Score", type: "number" as const }
];

function Harness() {
  const [branch, setBranch] = useState<ResultBranchDraft>(defaultResultBranch());
  return (
    <div>
      <EmissionBuilder branch={branch} inputFields={fields} resultFields={resultFields} onChange={setBranch} />
      <output aria-label="Branch state">{JSON.stringify(branch)}</output>
    </div>
  );
}

afterEach(() => {
  cleanup();
});

describe("EmissionBuilder", () => {
  it("lets users configure result branch publishing behavior without editing raw policies", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.getByLabelText("Subject source")).toBeVisible();
    expect(screen.getByLabelText("Gate failure behavior")).toBeVisible();
    expect(screen.getByText("Verify that the agent returned a summary before publishing the event.")).toBeVisible();
    expect(screen.getByText("Run and branch scoped")).toBeVisible();

    await user.selectOptions(screen.getByLabelText("Subject source"), "customerId");
    await user.selectOptions(screen.getByLabelText("Gate failure behavior"), "skip");
    await user.click(screen.getByLabelText("Require summary before publishing"));

    const state = JSON.parse(screen.getByLabelText("Branch state").textContent ?? "{}") as ResultBranchDraft;
    expect(state).toMatchObject({
      subjectField: "customerId",
      requireSummaryGate: false,
      onGateFailure: "skip"
    });
    expect(screen.getByText("No summary gate")).toBeVisible();
  });
});
