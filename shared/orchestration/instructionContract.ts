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
  const issues = REQUIRED_ACTION_INSTRUCTION_SECTIONS.flatMap((name) => {
    const matches = sections.filter((candidate) => candidate.name.toLocaleLowerCase() === name.toLocaleLowerCase());
    if (matches.length > 1) return [{ code: "duplicate_instruction_section", path: `sections.${name}`, message: `Duplicate ${name} section` }];
    const section = sections.find((candidate) => candidate.name.toLocaleLowerCase() === name.toLocaleLowerCase());
    if (!section) return [{ code: "missing_instruction_section", path: `sections.${name}`, message: `Missing ${name} section` }];
    if (!section.body.trim()) return [{ code: "empty_instruction_section", path: `sections.${name}`, message: `${name} section is empty` }];
    return [];
  });
  const positions = REQUIRED_ACTION_INSTRUCTION_SECTIONS.map((name) => sections.findIndex(
    (section) => section.name.toLocaleLowerCase() === name.toLocaleLowerCase()
  ));
  if (positions.every((position) => position >= 0)
    && positions.some((position, index) => index > 0 && position <= positions[index - 1]!)) {
    issues.push({ code: "instruction_section_order", path: "sections", message: "Required instruction sections are out of order" });
  }
  return issues;
};
