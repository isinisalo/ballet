// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { DataShapeFieldDraft } from "../../backend/shared/flow";
import { MappingBuilder } from "../src/components/mapping-builder/MappingBuilder";
import type { MappingRowDraft } from "../src/components/mapping-builder/mapping-builder-model";

afterEach(() => {
  cleanup();
});

describe("MappingBuilder human feedback", () => {
  it("shows required-field warnings, type warnings, and live mapped-value previews", () => {
    const sourceFields: DataShapeFieldDraft[] = [
      { name: "goal", label: "Goal", type: "text", required: true, example: "Launch" }
    ];
    const targetFields: DataShapeFieldDraft[] = [
      { name: "priority", label: "Priority", type: "number", required: true },
      { name: "missing", label: "Missing", type: "text", required: true }
    ];
    const rows: MappingRowDraft[] = [
      { target: "priority", sourceKind: "trigger-field", sourceField: "goal" },
      { target: "missing", sourceKind: "trigger-field", sourceField: "missing" }
    ];

    render(
      <MappingBuilder
        sourceFields={sourceFields}
        targetFields={targetFields}
        rows={rows}
        onChange={() => undefined}
      />
    );

    expect(screen.getByText("Goal is text, but Priority expects number.")).toBeVisible();
    expect(screen.getByText("Required field Missing has no available source or fallback.")).toBeVisible();
    expect(screen.getByText((_content, element) => element?.textContent === "Preview value · Launch")).toBeVisible();
    expect(screen.getByText(/Required mapping source is missing/)).toBeVisible();
  });

  it("previews mappings against caller-provided path roots", () => {
    const sourceFields: DataShapeFieldDraft[] = [
      { name: "decision", label: "Decision", type: "text", required: true, example: "Approved" }
    ];
    const targetFields: DataShapeFieldDraft[] = [
      { name: "decision", label: "Decision", type: "text", required: true }
    ];

    render(
      <MappingBuilder
        sourceFields={sourceFields}
        targetFields={targetFields}
        rows={[{ target: "decision", sourceKind: "trigger-field", sourceField: "decision" }]}
        onChange={() => undefined}
        pathOptions={{
          dataRoot: "/output/result",
          subjectPath: "/output/summary",
          projectPath: "/trigger/projectId",
          tagPathPrefix: "/trigger/tags"
        }}
      />
    );

    expect(screen.getByText((_content, element) => element?.textContent === "Preview value · Approved")).toBeVisible();
  });
});
