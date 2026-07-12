import type { MarkdownDocument, Project } from "@shared/api/workspace-contracts";
import { EmptyState } from "@/components/shared/workspace-ui";
import { ProjectMarkdownEditorView } from "./ProjectMarkdownEditorView";
import { type MarkdownEntity } from "./markdownDocument";
import type { ProjectDocumentCreateKind } from "../types";
import type { WorkspaceNavigation } from "../useWorkspaceNavigation";

type SaveProjectDocument = (document: Pick<MarkdownDocument, "relativePath" | "frontmatter" | "body">) => Promise<MarkdownDocument>;
type CreateProjectDocument = (kind: ProjectDocumentCreateKind, title: string) => Promise<MarkdownDocument>;

export function ProjectsOverview({
  project,
  saveProjectDocument,
  setNavigationBlocker
}: {
  project?: Project;
  saveProjectDocument: SaveProjectDocument;
  setNavigationBlocker: WorkspaceNavigation["setNavigationBlocker"];
}) {
  return (
    <ProjectMarkdownEditorView document={project} emptyTitle="No project document found." saveProjectDocument={saveProjectDocument} setNavigationBlocker={setNavigationBlocker} />
  );
}

export function ProjectDocumentPage({
  document,
  saveProjectDocument,
  setNavigationBlocker
}: {
  document?: MarkdownDocument;
  saveProjectDocument: SaveProjectDocument;
  setNavigationBlocker: WorkspaceNavigation["setNavigationBlocker"];
}) {
  return (
    <ProjectMarkdownEditorView document={document} emptyTitle="No project document selected." saveProjectDocument={saveProjectDocument} setNavigationBlocker={setNavigationBlocker} />
  );
}

export function GoalsPage({
  project,
  selectedGoal,
  saveProjectDocument,
  createProjectDocument,
  setNavigationBlocker
}: {
  project?: Project;
  selectedGoal?: MarkdownEntity;
  saveProjectDocument: SaveProjectDocument;
  createProjectDocument: CreateProjectDocument;
  setNavigationBlocker: WorkspaceNavigation["setNavigationBlocker"];
}) {
  if (!project) return <EmptyState title="No project selected." action="Open the Project page before reading GOALS." />;

  return (
    <ProjectMarkdownEditorView
      document={selectedGoal}
      emptyTitle="No Goal document selected."
      saveProjectDocument={saveProjectDocument}
      createProjectDocument={createProjectDocument}
      createKind="goal"
      setNavigationBlocker={setNavigationBlocker}
    />
  );
}

export function AdrsPage({
  project,
  selectedAdr,
  saveProjectDocument,
  createProjectDocument,
  setNavigationBlocker
}: {
  project?: Project;
  selectedAdr?: MarkdownEntity;
  saveProjectDocument: SaveProjectDocument;
  createProjectDocument: CreateProjectDocument;
  setNavigationBlocker: WorkspaceNavigation["setNavigationBlocker"];
}) {
  if (!project) return <EmptyState title="No project selected." action="Open the Project page before reading ADRs." />;

  return (
    <ProjectMarkdownEditorView
      document={selectedAdr}
      emptyTitle="No ADR document selected."
      saveProjectDocument={saveProjectDocument}
      createProjectDocument={createProjectDocument}
      createKind="adr"
      setNavigationBlocker={setNavigationBlocker}
    />
  );
}

export function InstructionsPage({
  project,
  selectedInstruction,
  saveProjectDocument,
  createProjectDocument,
  setNavigationBlocker
}: {
  project?: Project;
  selectedInstruction?: MarkdownEntity;
  saveProjectDocument: SaveProjectDocument;
  createProjectDocument: CreateProjectDocument;
  setNavigationBlocker: WorkspaceNavigation["setNavigationBlocker"];
}) {
  if (!project) return <EmptyState title="No project selected." action="Open the Project page before reading instructions." />;

  return (
    <ProjectMarkdownEditorView
      document={selectedInstruction}
      emptyTitle="No instruction document selected."
      saveProjectDocument={saveProjectDocument}
      createProjectDocument={createProjectDocument}
      createKind="instruction"
      setNavigationBlocker={setNavigationBlocker}
    />
  );
}
