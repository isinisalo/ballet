import { fromMarkdown } from "mdast-util-from-markdown";
import { canonicalJson, sha256, type JsonValue } from "../../../shared/orchestration/primitives.js";
import type { UserStoryV2 } from "../../../shared/orchestration/userStories.js";

const prose = (text: string): string => text.replace(/\s+/g, " ").trim();

/** CommonMark structure, links and code matter; source offsets, wrapping and marker spelling do not. */
const semanticMarkdown = (source: string): JsonValue => JSON.parse(JSON.stringify(
  fromMarkdown(source.replace(/\r\n?/g, "\n")),
  function (key, value: unknown) {
    if (key === "position" || key === "spread") return undefined;
    if (key === "value" && this.type === "text" && typeof value === "string") return value.replace(/\s+/g, " ");
    return value;
  }
)) as JsonValue;

export const userStoryApprovalHash = (story: UserStoryV2): string => sha256(canonicalJson({
  version: story.version, id: story.id,
  role: prose(story.role), goal: prose(story.goal), benefit: prose(story.benefit),
  acceptanceCriteria: story.acceptanceCriteria.map(({ given, when, then }) => ({ given: prose(given), when: prose(when), then: prose(then) })),
  adrIds: [...new Set(story.adrIds)].sort(), details: semanticMarkdown(story.details)
}));

export const invalidateStoryApproval = (story: UserStoryV2): UserStoryV2 => {
  if (story.status !== "approved" || story.approval?.contentHash === userStoryApprovalHash(story)) return story;
  const { approval, ...content } = story; void approval;
  return { ...content, status: "draft" };
};
