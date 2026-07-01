import type { MarkdownDocument, ProjectDocumentTreeNode } from "../../../../shared/api/workspace-contracts";
import type { ProjectDocumentCreateKind } from "../types";

export const projectTreeContainsPath = (nodes: ProjectDocumentTreeNode[], relativePath?: string): boolean =>
  Boolean(relativePath) && nodes.some((node) =>
    node.type === "file"
      ? node.document.relativePath === relativePath
      : projectTreeContainsPath(node.children, relativePath)
  );

export type ProjectTreeDirectory = Extract<ProjectDocumentTreeNode, { type: "directory" }>;

export const findProjectTreeDirectory = (nodes: ProjectDocumentTreeNode[], relativePath: string): ProjectTreeDirectory | undefined => {
  for (const node of nodes) {
    if (node.type === "directory") {
      if (node.relativePath === relativePath) return node;
      const directory = findProjectTreeDirectory(node.children, relativePath);
      if (directory) return directory;
    }
  }
  return undefined;
};

export const findProjectTreeDocument = (nodes: ProjectDocumentTreeNode[], relativePath?: string): MarkdownDocument | undefined => {
  if (!relativePath) return undefined;
  for (const node of nodes) {
    if (node.type === "file" && node.document.relativePath === relativePath) return node.document;
    if (node.type === "directory") {
      const document = findProjectTreeDocument(node.children, relativePath);
      if (document) return document;
    }
  }
  return undefined;
};

export const firstProjectTreeDocument = (node?: ProjectTreeDirectory): MarkdownDocument | undefined => {
  for (const child of node?.children ?? []) {
    if (child.type === "file") return child.document;
    const document = firstProjectTreeDocument(child);
    if (document) return document;
  }
  return undefined;
};

export const selectedProjectTreeDocument = (node?: ProjectTreeDirectory, relativePath?: string): MarkdownDocument | undefined => {
  const children = node?.children ?? [];
  const routedDocument = projectTreeContainsPath(children, relativePath) ? findProjectTreeDocument(children, relativePath) : undefined;
  return routedDocument ?? firstProjectTreeDocument(node);
};

export const projectDocumentCreateConfig: Record<ProjectDocumentCreateKind, { directoryPath: string; title: string; label: string }> = {
  adr: { directoryPath: ".ballet/adr", title: "New ADR", label: "New ADR" },
  goal: { directoryPath: ".ballet/goals", title: "New goal", label: "New goal" },
  instruction: { directoryPath: ".ballet/instructions", title: "New instruction", label: "New instruction" }
};

export const createKindForProjectDocument = (relativePath?: string): ProjectDocumentCreateKind | undefined => {
  if (relativePath?.startsWith(".ballet/adr/")) return "adr";
  if (relativePath?.startsWith(".ballet/goals/")) return "goal";
  if (relativePath?.startsWith(".ballet/instructions/")) return "instruction";
  return undefined;
};
