import { describe, expect, it } from "vitest";
import { sha256 } from "../../../shared/orchestration/primitives.js";
import { refinementPreimages } from "./RefinementPreimages.js";

const relativePath = ".agents/skills/example/SKILL.md";
const commit = "a".repeat(40);
const resource = { relativePath, content: "# Exact\n" };
const file = { operation: "replace", relative_path: relativePath, expected_preimage_hash: sha256(resource.content) };
describe("immutable Refinement preimages", () => {
  it("uses only hash-matching snapshot bytes, including deletion preimages", async () => {
    for (const operation of ["replace", "delete"]) {
      const [result] = await refinementPreimages("/missing", commit, [resource], [{ ...file, operation }]);
      expect(result.preimage_content).toBe(resource.content);
    }
  });
  it("rejects missing and hash-mismatched evidence instead of inventing an empty preimage", async () => {
    await expect(refinementPreimages("/missing", commit, [], [file])).rejects.toThrow("preimage is unavailable");
    await expect(refinementPreimages("/missing", commit, [{ ...resource, content: "changed" }], [file])).rejects.toThrow("preimage is unavailable");
  });
  it("allows a create without a preimage and rejects unsafe paths and Git revisions", async () => {
    expect((await refinementPreimages("/missing", commit, [], [{ ...file, operation: "create" }]))[0].preimage_content).toBeNull();
    await expect(refinementPreimages("/missing", commit, [], [{ ...file, relative_path: "../secret" }])).rejects.toThrow("allowed scope");
    await expect(refinementPreimages("/missing", "HEAD", [], [file])).rejects.toThrow("base commit");
  });
});
