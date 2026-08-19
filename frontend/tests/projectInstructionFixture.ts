import type { ProjectInstruction } from "@shared/api/workspace-contracts";

export const projectInstruction = (id: string): ProjectInstruction => ({
  id,
  title: id,
  body: "Instruction body.",
  relativePath: `.ballet/instructions/${id}.md`,
  origin: "project",
  valid: true,
  sourceSha256: "a".repeat(64),
  contentSha256: "b".repeat(64),
  sizeBytes: 17
});
