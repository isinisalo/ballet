import type { MarkdownDocument, Project } from "@shared/api/workspace-contracts";
import { EmptyState } from "@/components/shared/workspace-ui";
import { ProjectMarkdownEditorView } from "./ProjectMarkdownEditorView";
import { type MarkdownEntity } from "./markdownDocument";
import type { ProjectDocumentCreateKind } from "../types";

type SaveProjectDocument = (document: Pick<MarkdownDocument, "relativePath" | "frontmatter" | "body">) => Promise<MarkdownDocument>;
type CreateProjectDocument = (kind: ProjectDocumentCreateKind, title: string) => Promise<MarkdownDocument>;

export function ProjectsOverview({
  project,
  saveProjectDocument
}: {
  project?: Project;
  saveProjectDocument: SaveProjectDocument;
}) {
  return (
    <ProjectMarkdownEditorView document={project} emptyTitle="No project document found." saveProjectDocument={saveProjectDocument} />
  );
}

export function ProjectDocumentPage({
  document,
  saveProjectDocument
}: {
  document?: MarkdownDocument;
  saveProjectDocument: SaveProjectDocument;
}) {
  return (
    <ProjectMarkdownEditorView document={document} emptyTitle="No project document selected." saveProjectDocument={saveProjectDocument} />
  );
}

export function GoalsPage({
  project,
  selectedGoal,
  saveProjectDocument,
  createProjectDocument
}: {
  project?: Project;
  selectedGoal?: MarkdownEntity;
  saveProjectDocument: SaveProjectDocument;
  createProjectDocument: CreateProjectDocument;
}) {
  if (!project) return <EmptyState title="No project selected." action="Open the Project page before reading GOALS." />;

  return (
    <ProjectMarkdownEditorView
      document={selectedGoal}
      emptyTitle="No Goal document selected."
      saveProjectDocument={saveProjectDocument}
      createProjectDocument={createProjectDocument}
      createKind="goal"
    />
  );
}

export function AdrsPage({
  project,
  selectedAdr,
  saveProjectDocument,
  createProjectDocument
}: {
  project?: Project;
  selectedAdr?: MarkdownEntity;
  saveProjectDocument: SaveProjectDocument;
  createProjectDocument: CreateProjectDocument;
}) {
  if (!project) return <EmptyState title="No project selected." action="Open the Project page before reading ADRs." />;

  return (
    <ProjectMarkdownEditorView
      document={selectedAdr}
      emptyTitle="No ADR document selected."
      saveProjectDocument={saveProjectDocument}
      createProjectDocument={createProjectDocument}
      createKind="adr"
    />
  );
}

export function InstructionsPage({
  project,
  selectedInstruction,
  saveProjectDocument,
  createProjectDocument
}: {
  project?: Project;
  selectedInstruction?: MarkdownEntity;
  saveProjectDocument: SaveProjectDocument;
  createProjectDocument: CreateProjectDocument;
}) {
  if (!project) return <EmptyState title="No project selected." action="Open the Project page before reading instructions." />;

  return (
    <ProjectMarkdownEditorView
      document={selectedInstruction}
      emptyTitle="No instruction document selected."
      saveProjectDocument={saveProjectDocument}
      createProjectDocument={createProjectDocument}
      createKind="instruction"
    />
  );
}
