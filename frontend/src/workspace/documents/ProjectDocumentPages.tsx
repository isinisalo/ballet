import type { MarkdownDocument, Project } from "@shared/api/workspace-contracts";
import { EmptyState } from "@/components/shared/workspace-ui";
import { DocumentCollectionOverview } from "./DocumentCollectionOverview";
import { ProjectMarkdownEditorView } from "./ProjectMarkdownEditorView";
import { type MarkdownEntity } from "./markdownDocument";
import type { ProjectDocumentCreateKind } from "../types";
import type { WorkspaceNavigation } from "../useWorkspaceNavigation";

type SaveProjectDocument = (document: Pick<MarkdownDocument, "relativePath" | "frontmatter" | "body">) => Promise<MarkdownDocument>;
type CreateProjectDocument = (kind: ProjectDocumentCreateKind, title: string) => Promise<MarkdownDocument>;

export function ProjectsOverview({ project, saveProjectDocument, setNavigationBlocker }: {
  project?: Project;
  saveProjectDocument: SaveProjectDocument;
  setNavigationBlocker: WorkspaceNavigation["setNavigationBlocker"];
}) {
  return <ProjectMarkdownEditorView document={project} emptyTitle="No project document found." saveProjectDocument={saveProjectDocument} setNavigationBlocker={setNavigationBlocker} />;
}

export function ProjectDocumentPage({ document, saveProjectDocument, setNavigationBlocker }: {
  document?: MarkdownDocument;
  saveProjectDocument: SaveProjectDocument;
  setNavigationBlocker: WorkspaceNavigation["setNavigationBlocker"];
}) {
  return <ProjectMarkdownEditorView document={document} emptyTitle="No project document selected." saveProjectDocument={saveProjectDocument} setNavigationBlocker={setNavigationBlocker} />;
}

type ProjectCollectionPageProps = {
  project?: Project;
  documents: MarkdownDocument[];
  selectedDocument?: MarkdownEntity;
  creating?: boolean;
  kind: ProjectDocumentCreateKind;
  emptyTitle: string;
  saveProjectDocument: SaveProjectDocument;
  createProjectDocument: CreateProjectDocument;
  navigate: WorkspaceNavigation["navigate"];
  setNavigationBlocker: WorkspaceNavigation["setNavigationBlocker"];
};

function ProjectCollectionPage({ project, documents, selectedDocument, creating = false, kind, emptyTitle, saveProjectDocument, createProjectDocument, navigate, setNavigationBlocker }: ProjectCollectionPageProps) {
  if (!project) return <EmptyState title="No project selected." action={`Open the Project page before reading ${kind === "goal" ? "GOALS" : kind === "adr" ? "ADRs" : "instructions"}.`} />;
  if (!selectedDocument && !creating) return <DocumentCollectionOverview kind={kind} documents={documents} navigate={navigate} />;
  return (
    <ProjectMarkdownEditorView
      document={selectedDocument}
      emptyTitle={emptyTitle}
      saveProjectDocument={saveProjectDocument}
      createProjectDocument={createProjectDocument}
      createKind={creating ? kind : undefined}
      setNavigationBlocker={setNavigationBlocker}
    />
  );
}

type CollectionPageProps = Omit<ProjectCollectionPageProps, "selectedDocument" | "kind" | "emptyTitle">;

export function GoalsPage({ selectedGoal, ...props }: CollectionPageProps & { selectedGoal?: MarkdownEntity }) {
  return <ProjectCollectionPage {...props} selectedDocument={selectedGoal} kind="goal" emptyTitle="No Goal document selected." />;
}

export function AdrsPage({ selectedAdr, ...props }: CollectionPageProps & { selectedAdr?: MarkdownEntity }) {
  return <ProjectCollectionPage {...props} selectedDocument={selectedAdr} kind="adr" emptyTitle="No ADR document selected." />;
}

export function InstructionsPage({ selectedInstruction, ...props }: CollectionPageProps & { selectedInstruction?: MarkdownEntity }) {
  return <ProjectCollectionPage {...props} selectedDocument={selectedInstruction} kind="instruction" emptyTitle="No instruction document selected." />;
}
