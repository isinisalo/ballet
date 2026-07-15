const milestoneFieldPattern = /^[\t ]*milestone_id[\t ]*:/gm;
const milestoneDeclarationPattern = /^[\t ]*milestone_id[\t ]*(?::)[\t ]*(milestone-\d{3})[\t ]*$/gm;
const githubIssueFieldPattern = /^[\t ]*github_issue[\t ]*:/gm;
const githubIssueDeclarationPattern = /^[\t ]*github_issue[\t ]*(?::)[\t ]*([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+#[1-9]\d*)[\t ]*$/gm;

export const BLUEPRINT_LOOP_ID = "blueprint-design" as const;
export const GATED_LOOP_IDS = ["milestone-planning", "milestone-delivery", "release-validation"] as const;
export type GatedLoopId = (typeof GATED_LOOP_IDS)[number];

export interface MilestoneLoopHandoff {
  milestoneId: string;
  githubIssues: string[];
}

export class LoopHandoffValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LoopHandoffValidationError";
  }
}

const matches = (input: string, pattern: RegExp): string[] => [...input.matchAll(pattern)].map((match) => match[1] ?? "");

export const parseMilestoneLoopHandoff = (input?: string): MilestoneLoopHandoff => {
  const value = input ?? "";
  const milestoneFields = [...value.matchAll(milestoneFieldPattern)];
  const milestoneDeclarations = matches(value, milestoneDeclarationPattern);
  if (milestoneFields.length !== 1 || milestoneDeclarations.length !== 1) {
    throw new LoopHandoffValidationError(
      "Handoff must contain exactly one line in the form milestone_id: milestone-NNN."
    );
  }

  const githubIssueFields = [...value.matchAll(githubIssueFieldPattern)];
  const githubIssues = matches(value, githubIssueDeclarationPattern);
  if (githubIssueFields.length === 0 || githubIssueFields.length !== githubIssues.length) {
    throw new LoopHandoffValidationError(
      "Handoff must contain at least one line in the form github_issue: owner/repository#number."
    );
  }

  const uniqueIssues = new Set(githubIssues);
  if (uniqueIssues.size !== githubIssues.length) {
    throw new LoopHandoffValidationError("Handoff cannot contain duplicate github_issue declarations.");
  }

  return { milestoneId: milestoneDeclarations[0]!, githubIssues };
};

export const isGatedLoopId = (loopId: string): loopId is GatedLoopId =>
  (GATED_LOOP_IDS as readonly string[]).includes(loopId);

export const validateLoopTransitionHandoff = (loopId: string, input?: string): void => {
  if (isGatedLoopId(loopId)) parseMilestoneLoopHandoff(input);
};
