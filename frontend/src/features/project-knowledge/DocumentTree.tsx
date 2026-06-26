import { FileText, Folder } from "lucide-react";
import type { MarkdownDocument, ProjectDocumentTreeNode } from "backend/shared/domain";

export function DocumentTree({
  nodes,
  selectedId,
  onSelect
}: {
  nodes: ProjectDocumentTreeNode[];
  selectedId?: string;
  onSelect: (document: MarkdownDocument) => void;
}) {
  return (
    <div className="grid gap-1">
      {nodes.map((node) => node.type === "directory"
        ? (
          <div key={node.relativePath} className="grid gap-1">
            <div className="mt-2 flex items-center gap-2 font-mono text-[0.68rem] uppercase text-muted-foreground"><Folder className="size-3.5" />{node.label}</div>
            <div className="ml-3 border-l border-white/10 pl-3">
              <DocumentTree nodes={node.children} selectedId={selectedId} onSelect={onSelect} />
            </div>
          </div>
        )
        : (
          <button
            key={node.document.id}
            type="button"
            className={`flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm ${selectedId === node.document.id ? "bg-primary/20 text-primary-foreground" : "hover:bg-white/8"}`}
            onClick={() => onSelect(node.document)}
          >
            <FileText className="size-4 shrink-0 text-cyan-200" />
            <span className="min-w-0 truncate">{node.document.title ?? node.label}</span>
          </button>
        ))}
    </div>
  );
}
