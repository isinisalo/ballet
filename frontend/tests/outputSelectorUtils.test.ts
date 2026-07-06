import { describe, expect, it } from "vitest";
import {
  nextSelectedOutputIds,
  normalizeOutputId,
  outputCanCreate,
  outputSuggestions,
  outputValidationMessage
} from "../src/workspace/automation/outputs/outputSelectorUtils";

describe("output selector utilities", () => {
  it("normalizes output ids to lowercase automation tokens", () => {
    expect(normalizeOutputId(" Warm Output ")).toBe("warm-output");
    expect(normalizeOutputId("READY")).toBe("ready");
  });

  it("validates output length and empty values", () => {
    expect(outputValidationMessage("")).toBe("Output id is required.");
    expect(outputValidationMessage("a")).toBe("Use at least 2 characters.");
    expect(outputValidationMessage("a".repeat(33))).toBe("Use 32 characters or fewer.");
    expect(outputValidationMessage("warm")).toBeUndefined();
  });

  it("filters selected outputs out of suggestions", () => {
    expect(outputSuggestions(["ready", "cancelled", "warn"], ["ready"], "war")).toEqual(["warn"]);
  });

  it("prevents duplicate creation and caps selection length", () => {
    expect(outputCanCreate("READY", ["ready"], [])).toBe(false);
    expect(outputCanCreate("warm", ["ready"], ["warn"])).toBe(true);
    expect(nextSelectedOutputIds(["ready", "warn", "ready"], "cancelled", 3)).toEqual(["ready", "warn", "cancelled"]);
  });
});
