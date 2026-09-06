import { describe, expect, test } from "vitest";
import { userStorySchema } from "../../../shared/orchestration/userStories.js";
import { userStoryApprovalHash } from "./userStoryApproval.js";

const story = userStorySchema.parse({ version: 2, id: "00000000-0000-4000-8000-000000000001",
  status: "draft", approvalRevision: 0, role: "owner", goal: "to approve", benefit: "intent is clear",
  acceptanceCriteria: [{ given: "one", when: "two", then: "three" }, { given: "four", when: "five", then: "six" }], adrIds: ["adr-1", "adr-2"], details: "[Contract](./first.md)\n\n    exact code\n" });
const hash = userStoryApprovalHash(story);
describe("User Story semantic hash", () => {
  test("binds references, criterion order, link destinations, code and all prose", () => {
    for (const change of [ { adrIds: ["adr-3"] }, { acceptanceCriteria: [...story.acceptanceCriteria].reverse() },
      { details: story.details.replace("first.md", "second.md") }, { details: story.details.replace("exact code", "exact  code") },
      ...["role", "goal", "benefit"].map((key) => ({ [key]: "new" })) ]) {
      expect(userStoryApprovalHash({ ...story, ...change })).not.toBe(hash);
    }
  });
  test("ignores reference set order and approval metadata, without stripping meaningful structure", () => {
    expect(userStoryApprovalHash({ ...story, adrIds: ["adr-2", "adr-1", "adr-1"], approvalRevision: 9 })).toBe(hash);
    expect(userStoryApprovalHash({ ...story, details: "  " + story.details })).toBe(hash);
    expect(userStoryApprovalHash({ ...story, details: "plain text" })).not.toBe(hash);
  });
});
