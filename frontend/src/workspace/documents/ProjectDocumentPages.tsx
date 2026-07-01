import type { ReactNode } from "react";
import { Archive, CheckCircle2, FileText, Plus } from "lucide-react";
import type { MarkdownDocument, Project } from "../../../../shared/api/workspace-contracts";
import { Button } from "@/components/ui/button";
import { EmptyState, Panel } from "@/components/shared/workspace-ui";
import { MarkdownDocumentView } from "./MarkdownDocumentView";
import { ProjectMarkdownEditorView } from "./ProjectMarkdownEditorView";
import { type MarkdownEntity } from "./markdownDocument";
import { projectDocumentCreateConfig } from "./projectDocuments";
import type { ProjectDocumentCreateKind } from "../types";

export function ProjectsOverview({
  project,
  saveProjectDocument
}: {
  project?: Project;
  saveProjectDocument: (document: Pick<MarkdownDocument, "relativePath" | "frontmatter" | "body">) => Promise<MarkdownDocument>;
}) {
  return (
    <ProjectMarkdownEditorView document={project} emptyTitle="No project document found." saveProjectDocument={saveProjectDocument} />
  );
}

export function ProjectDocumentPage({
  document,
  saveProjectDocument,
  onCreateDocument
}: {
  document?: MarkdownDocument;
  saveProjectDocument: (document: Pick<MarkdownDocument, "relativePath" | "frontmatter" | "body">) => Promise<MarkdownDocument>;
  onCreateDocument: (kind: ProjectDocumentCreateKind) => void;
}) {
  return (
    <ProjectMarkdownEditorView document={document} emptyTitle="No project document selected." saveProjectDocument={saveProjectDocument} onCreateDocument={onCreateDocument} />
  );
}

export function GoalsPage({ project, selectedGoal, onCreateDocument }: { project?: Project; selectedGoal?: MarkdownEntity; onCreateDocument: (kind: ProjectDocumentCreateKind) => void }) {
  if (!project) return <EmptyState title="No project selected." action="Open the Project page before reading GOALS." />;

  return (
    <CollectionDocumentPanel
      title="Goals"
      icon={<CheckCircle2 data-icon="inline-start" />}
      document={selectedGoal}
      emptyTitle="No Goal document selected."
      createKind="goal"
      onCreateDocument={onCreateDocument}
    />
  );
}

export function AdrsPage({ project, selectedAdr, onCreateDocument }: { project?: Project; selectedAdr?: MarkdownEntity; onCreateDocument: (kind: ProjectDocumentCreateKind) => void }) {
  if (!project) return <EmptyState title="No project selected." action="Open the Project page before reading ADRs." />;

  return (
    <CollectionDocumentPanel
      title="ADR"
      icon={<Archive data-icon="inline-start" />}
      document={selectedAdr}
      emptyTitle="No ADR document selected."
      createKind="adr"
      onCreateDocument={onCreateDocument}
    />
  );
}

export function InstructionsPage({
  project,
  selectedInstruction,
  onCreateDocument
}: {
  project?: Project;
  selectedInstruction?: MarkdownEntity;
  onCreateDocument: (kind: ProjectDocumentCreateKind) => void;
}) {
  if (!project) return <EmptyState title="No project selected." action="Open the Project page before reading instructions." />;

  return (
    <CollectionDocumentPanel
      title="Instructions"
      icon={<FileText data-icon="inline-start" />}
      document={selectedInstruction}
      emptyTitle="No instruction document selected."
      createKind="instruction"
      onCreateDocument={onCreateDocument}
    />
  );
}

export function CollectionDocumentPanel({
  title,
  icon,
  document,
  emptyTitle,
  createKind,
  onCreateDocument
}: {
  title: string;
  icon: ReactNode;
  document?: MarkdownEntity;
  emptyTitle: string;
  createKind: ProjectDocumentCreateKind;
  onCreateDocument: (kind: ProjectDocumentCreateKind) => void;
}) {
  const createConfig = projectDocumentCreateConfig[createKind];

  return (
    <Panel
      title={title}
      icon={icon}
      compact
      action={(
        <Button type="button" size="icon-sm" variant="outline" aria-label={createConfig.label} title={createConfig.label} onClick={() => onCreateDocument(createKind)}>
          <Plus data-icon="inline-start" />
        </Button>
      )}
    >
      <MarkdownDocumentView document={document} emptyTitle={emptyTitle} compact embedded />
    </Panel>
  );
}
