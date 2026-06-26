// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import type { DataShapeFieldDraft } from "../../backend/shared/flow";
import { DataShapeBuilder } from "../src/components/data-shape-builder/DataShapeBuilder";
import {
  agentOutputExampleFromFields,
  agentOutputSchemaFromFields,
  evidenceFieldsFromAgentOutputSchema,
  exampleFromFields,
  fieldsFromObjectSchema,
  objectSchemaFromFields,
  resultFieldsFromAgentOutputSchema
} from "../src/components/data-shape-builder/data-shape-builder-model";

afterEach(() => {
  cleanup();
});

function Harness({
  initial,
  onFields
}: {
  initial: DataShapeFieldDraft[];
  onFields: (fields: DataShapeFieldDraft[]) => void;
}) {
  const [fields, setFields] = useState(initial);
  return (
    <DataShapeBuilder
      fields={fields}
      onChange={(next) => {
        setFields(next);
        onFields(next);
      }}
    />
  );
}

describe("DataShapeBuilder", () => {
  it("captures allowed values, typed defaults, and typed examples without JSON Schema editing", async () => {
    const user = userEvent.setup();
    let latest: DataShapeFieldDraft[] = [];

    render(
      <Harness
        initial={[{ name: "score", label: "Score", type: "number", required: true }]}
        onFields={(fields) => {
          latest = fields;
        }}
      />
    );

    await user.type(screen.getByLabelText("Default"), "abc");
    expect(screen.getByRole("alert")).toHaveTextContent("Default must be a number.");

    await user.clear(screen.getByLabelText("Default"));
    await user.type(screen.getByLabelText("Default"), "3");
    await user.type(screen.getByLabelText("Example"), "4");

    expect(latest[0]?.default).toBe(3);
    expect(latest[0]?.example).toBe(4);
    expect(screen.queryByText("Default must be a number.")).not.toBeInTheDocument();
  });

  it("validates field names, duplicates, and text allowed values continuously", async () => {
    const user = userEvent.setup();
    let latest: DataShapeFieldDraft[] = [];

    render(
      <Harness
        initial={[
          { name: "decision", label: "Decision", type: "text", required: true },
          { name: "decision", label: "Duplicate decision", type: "number" }
        ]}
        onFields={(fields) => {
          latest = fields;
        }}
      />
    );

    expect(screen.getAllByRole("alert")[0]).toHaveTextContent("decision is already used by another field.");

    await user.type(screen.getAllByLabelText("Allowed values")[0]!, "Approved, Changes requested");
    expect(latest[0]?.allowedValues).toEqual(["Approved", "Changes requested"]);

    await user.type(screen.getAllByLabelText("Allowed values")[1]!, "1, 2");
    expect(screen.getAllByRole("alert")[1]).toHaveTextContent("Allowed values are currently supported for text fields.");
  });

  it("round-trips fields through JSON Schema Draft 2020-12 and examples", () => {
    const fields: DataShapeFieldDraft[] = [
      { name: "decision", label: "Decision", description: "", type: "text", required: true, allowedValues: ["Approved", "Changes requested"], example: "Approved" },
      { name: "score", label: "Score", description: "", type: "number", required: false, default: 1 },
      { name: "checks", label: "Checks", description: "", type: "object-list", required: false }
    ];

    const schema = objectSchemaFromFields(fields);

    expect(schema).toMatchObject({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      additionalProperties: false,
      required: ["decision"],
      properties: {
        decision: { title: "Decision", type: "string", enum: ["Approved", "Changes requested"], examples: ["Approved"] },
        score: { title: "Score", type: "number", default: 1 },
        checks: { title: "Checks", type: "array", items: { type: "object", additionalProperties: true } }
      }
    });
    expect(fieldsFromObjectSchema(schema)).toEqual(fields);
    expect(exampleFromFields(fields)).toEqual({
      decision: "Approved",
      score: 1,
      checks: [{ name: "example", status: "passed" }]
    });
  });

  it("builds agent-output schemas with a protected execution envelope", () => {
    const resultFields: DataShapeFieldDraft[] = [
      { name: "decision", label: "Decision", description: "", type: "text", required: true, allowedValues: ["Approved"], example: "Approved" }
    ];
    const evidenceFields: DataShapeFieldDraft[] = [
      { name: "checks", label: "Checks", description: "", type: "object-list", required: false }
    ];

    const schema = agentOutputSchemaFromFields(resultFields, evidenceFields);

    expect(schema).toMatchObject({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      additionalProperties: false,
      required: ["status", "summary"],
      properties: {
        status: { title: "Status", type: "string", enum: ["completed", "blocked", "needs_input", "failed"] },
        summary: { title: "Summary", type: "string" },
        result: {
          type: "object",
          additionalProperties: false,
          required: ["decision"],
          properties: {
            decision: { title: "Decision", type: "string", enum: ["Approved"], examples: ["Approved"] }
          }
        },
        evidence: {
          type: "object",
          additionalProperties: false,
          properties: {
            checks: { title: "Checks", type: "array", items: { type: "object", additionalProperties: true } }
          }
        }
      }
    });
    expect(resultFieldsFromAgentOutputSchema(schema)).toEqual(resultFields);
    expect(evidenceFieldsFromAgentOutputSchema(schema)).toEqual(evidenceFields);
    expect(agentOutputExampleFromFields(resultFields, evidenceFields)).toEqual({
      status: "completed",
      summary: "Dry-run completed",
      result: { decision: "Approved" },
      evidence: { checks: [{ name: "example", status: "passed" }] }
    });
  });
});
