import { userStoryInputSchema, type UserStoryInput } from "@shared/orchestration/userStories";

export const STORY_PARTS = [
  { key: "role", label: "Role", prefix: "As a", placeholder: "project owner" },
  { key: "goal", label: "Goal", prefix: "I want", placeholder: "to describe the outcome I need" },
  { key: "benefit", label: "Benefit", prefix: "so that", placeholder: "the team understands why it matters" }
] as const;
export const CRITERION_PARTS = ["given", "when", "then"] as const;
export const shortStoryId = (id: string) => `US · ${id.slice(0, 8)}`;
export const emptyStory = (): UserStoryInput => ({ role: "", goal: "", benefit: "", acceptanceCriteria: [], adrIds: [], details: "" });
export const storyInput = (value: UserStoryInput): UserStoryInput => ({
  role: value.role, goal: value.goal, benefit: value.benefit,
  details: value.details ?? "", adrIds: value.adrIds ?? [],
  acceptanceCriteria: value.acceptanceCriteria.map(({ given, when, then }) => ({ given, when, then }))
});
export function storyFieldErrors(value: UserStoryInput): Record<string, string> {
  const result = userStoryInputSchema.safeParse(value);
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((issue) => [issue.path.join("."),
    issue.code === "too_small" ? "This field is required." : issue.message]));
}

export const storyEditorStatus = (locked: boolean, unavailable: boolean, pending: boolean, dirty: boolean, saved: boolean) =>
  locked ? "Locked by active Run" : unavailable ? "File unavailable" : pending ? "Saving…" : dirty ? "Unsaved" : saved ? "Saved" : "New";
