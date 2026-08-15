import type { Skill } from "@shared/api/workspace-contracts";
import { StatusDot } from "@/components/shared/workspace-ui";
import {
  SidebarMenuSub
} from "@/components/ui/sidebar";
import { SidebarNavLinkItem } from "./SidebarNavLinkItem";

type SidebarDocumentEntity = Pick<Skill, "id" | "name" | "relativePath" | "valid">;

export function SidebarDocumentList({
  documents,
  activePath,
  pathFor,
  navigate
}: {
  documents: SidebarDocumentEntity[];
  activePath?: string;
  pathFor: (relativePath: string) => string;
  navigate: (path: string) => void;
}) {
  if (documents.length === 0) return null;

  return (
    <SidebarMenuSub>
      {documents.map((document) => {
        const relativePath = document.relativePath;
        if (!relativePath) return null;
        const path = pathFor(relativePath);
        return (
          <SidebarNavLinkItem
            key={document.id}
            path={path}
            isActive={relativePath === activePath}
            navigate={navigate}
            className="h-9 min-w-0 items-start py-1 text-muted-foreground data-active:text-sidebar-accent-foreground"
          >
            <StatusDot tone={document.valid ? "healthy" : "danger"} className="mt-1.5" />
            <span className="grid min-w-0" title={`${document.id} · ${relativePath} · ${document.valid ? "valid" : "invalid"}`}><span className="truncate">{document.name}</span><span className="truncate font-mono text-[0.55rem] text-muted-foreground">{document.id} · {relativePath}</span></span>
          </SidebarNavLinkItem>
        );
      })}
    </SidebarMenuSub>
  );
}
