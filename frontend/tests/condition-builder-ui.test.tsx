// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DataShapeFieldDraft } from "../../backend/shared/flow";
import { ConditionBuilder } from "../src/components/condition-builder/ConditionBuilder";
import type { ConditionDraft } from "../src/components/condition-builder/condition-builder-model";

const fields: DataShapeFieldDraft[] = [
  { name: "decision", label: "Decision", type: "text", required: true },
  { name: "score", label: "Score", type: "number" }
];

afterEach(() => {
  cleanup();
});

describe("ConditionBuilder visual editor", () => {
  it("renders all/any/not condition groups in plain language", () => {
    render(
      <ConditionBuilder
        fields={fields}
        value={{
          kind: "all",
          conditions: [
            { field: "decision", op: "eq", value: "Approved" },
            {
              kind: "not",
              condition: { field: "score", op: "lt", value: "3" }
            }
          ]
        }}
        onChange={() => undefined}
      />
    );

    expect(screen.getByText("When all of these are true")).toBeVisible();
    expect(screen.getByText("Condition 1")).toBeVisible();
    expect(screen.getByText("Condition 2")).toBeVisible();
    expect(screen.getByText("When Decision is Approved")).toBeVisible();
    expect(screen.getByText("When not: When Score is less than 3")).toBeVisible();
  });

  it("adds child conditions without requiring a raw condition AST", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const value: ConditionDraft = {
      kind: "any",
      conditions: [{ field: "decision", op: "eq", value: "Approved" }]
    };

    render(<ConditionBuilder fields={fields} value={value} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /add condition/i }));

    expect(onChange).toHaveBeenCalledWith({
      kind: "any",
      conditions: [
        { field: "decision", op: "eq", value: "Approved" },
        { field: "decision", op: "eq", value: "" }
      ]
    });
  });
});
