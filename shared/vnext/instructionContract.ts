import type { ContractIssue } from "./primitives.js";

export const REQUIRED_ACTION_INSTRUCTION_SECTIONS = [
  "Task",
  "Role",
  "Goals",
  "Priorities",
  "Method",
  "Output contract",
  "Tool policy",
  "Acceptance evidence"
] as const;

interface MarkdownSection {
  name: string;
  body: string;
}

const parseSections = (markdown: string): MarkdownSection[] => {
  const lines = markdown.split(/\r?\n/);
  const sections: MarkdownSection[] = [];
  let current: MarkdownSection | undefined;
  for (const line of lines) {
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (match) {
      current = { name: match[2], body: "" };
      sections.push(current);
    } else if (current) {
      current.body += `${line}\n`;
    }
  }
  return sections;
};

export const validateActionInstruction = (markdown: string): ContractIssue[] => {
  const sections = parseSections(markdown);
  return REQUIRED_ACTION_INSTRUCTION_SECTIONS.flatMap((name) => {
    const section = sections.find((candidate) => candidate.name.toLocaleLowerCase() === name.toLocaleLowerCase());
    if (!section) return [{ code: "missing_instruction_section", path: `sections.${name}`, message: `Missing ${name} section` }];
    if (!section.body.trim()) return [{ code: "empty_instruction_section", path: `sections.${name}`, message: `${name} section is empty` }];
    return [];
  });
};
