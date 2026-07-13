import type { MarkdownDocument } from "@shared/api/workspace-contracts";
import { Archive, CheckCircle2, FileText, type LucideIcon } from "lucide-react";
import { CollectionCardGrid, CollectionEntityCard, OperationalStatus, Panel, type OperationalStatusTone } from "@/components/shared/workspace-ui";
import { projectCollectionCreatePath, projectCollectionDocumentPath } from "../routing";
import type { ProjectDocumentCreateKind } from "../types";
import type { WorkspaceNavigation } from "../useWorkspaceNavigation";
import { documentTitle } from "./markdownDocument";

const collectionConfig: Record<ProjectDocumentCreateKind, { title: string; addLabel: string; icon: LucideIcon }> = {
  adr: { title: "ADR", addLabel: "Add ADR", icon: Archive },
  goal: { title: "Goals", addLabel: "Add goal", icon: CheckCircle2 },
  instruction: { title: "Instructions", addLabel: "Add instruction", icon: FileText }
};

const frontmatterString = (document: MarkdownDocument, ...keys: string[]) => {
  for (const key of keys) {
    const value = document.frontmatter[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return undefined;
};

const documentTags = (document: MarkdownDocument) => {
  const tags = document.frontmatter.tags;
  return Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === "string" && Boolean(tag.trim())) : [];
};

const documentStatusTone = (status: string): OperationalStatusTone => {
  const normalized = status.toLocaleLowerCase();
  if (["accepted", "active", "approved"].includes(normalized)) return "healthy";
  if (["draft", "proposed", "pending", "paused"].includes(normalized)) return "attention";
  return "neutral";
};

export function DocumentCollectionOverview({ kind, documents, navigate }: {
  kind: ProjectDocumentCreateKind;
  documents: MarkdownDocument[];
  navigate: WorkspaceNavigation["navigate"];
}) {
  const config = collectionConfig[kind];
  const Icon = config.icon;
  return (
    <Panel title={config.title} icon={<Icon />} contentClassName="p-0">
      <CollectionCardGrid label={config.title} addLabel={config.addLabel} onAdd={() => navigate(projectCollectionCreatePath(kind))}>
        {documents.map((document) => {
          const status = frontmatterString(document, "status");
          const updated = frontmatterString(document, "updatedAt", "updated_date", "updatedDate");
          const tags = documentTags(document);
          return (
            <CollectionEntityCard
              key={document.relativePath}
              icon={<Icon />}
              title={documentTitle(document)}
              identifier={document.id}
              status={status ? <OperationalStatus compact label={status} tone={documentStatusTone(status)} /> : undefined}
              metadata={(updated || tags.length > 0) ? <>
                {updated ? <span>updated: {updated}</span> : null}
                {tags.length > 0 ? <span className="min-w-0 truncate" title={tags.join(", ")}>tags: {tags.join(", ")}</span> : null}
              </> : undefined}
              openLabel={`Open ${kind} ${documentTitle(document)}`}
              onOpen={() => navigate(projectCollectionDocumentPath(kind, document.relativePath))}
            />
          );
        })}
      </CollectionCardGrid>
    </Panel>
  );
}
