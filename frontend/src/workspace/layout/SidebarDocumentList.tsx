import type { Agent, Skill } from "@shared/api/workspace-contracts";
import {
  SidebarMenuSub
} from "@/components/ui/sidebar";
import { SidebarNavLinkItem } from "./SidebarNavLinkItem";

type SidebarDocumentEntity = Pick<Agent | Skill, "id" | "name" | "relativePath">;

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
            className="h-6 min-w-0 text-muted-foreground data-active:text-sidebar-accent-foreground"
          >
            <span className="truncate">{document.name}</span>
          </SidebarNavLinkItem>
        );
      })}
    </SidebarMenuSub>
  );
}
