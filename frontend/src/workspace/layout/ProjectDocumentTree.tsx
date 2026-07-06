import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import type { ProjectDocumentTreeNode } from "../../../../shared/api/workspace-contracts";
import { projectDocumentPath } from "../routing";
import { projectTreeContainsPath } from "../documents/projectDocuments";
import { SidebarNavLinkItem } from "./SidebarNavLinkItem";

export function ProjectDocumentTree({
  nodes,
  activePath,
  navigate,
  pathFor = projectDocumentPath,
  level = 0
}: {
  nodes: ProjectDocumentTreeNode[];
  activePath?: string;
  navigate: (path: string) => void;
  pathFor?: (relativePath: string) => string;
  level?: number;
}) {
  if (nodes.length === 0) return null;

  return (
    <SidebarMenuSub className={cn(level > 0 && "mx-2 mt-1 gap-0.5 border-sidebar-border/60 px-2 py-1")}>
      {nodes.map((node) => {
        if (node.type === "file") {
          const path = pathFor(node.document.relativePath);
          return (
            <SidebarNavLinkItem
              key={node.document.relativePath}
              path={path}
              isActive={node.document.relativePath === activePath}
              navigate={navigate}
              className="h-6 text-muted-foreground data-active:text-sidebar-accent-foreground"
            >
              <span>{node.label}</span>
            </SidebarNavLinkItem>
          );
        }

        return (
          <ProjectDocumentTreeDirectory
            key={node.relativePath}
            node={node}
            activePath={activePath}
            navigate={navigate}
            pathFor={pathFor}
            level={level}
          />
        );
      })}
    </SidebarMenuSub>
  );
}

function ProjectDocumentTreeDirectory({
  node,
  activePath,
  navigate,
  pathFor,
  level
}: {
  node: Extract<ProjectDocumentTreeNode, { type: "directory" }>;
  activePath?: string;
  navigate: (path: string) => void;
  pathFor: (relativePath: string) => string;
  level: number;
}) {
  const containsActive = projectTreeContainsPath(node.children, activePath);
  const [open, setOpen] = useState(containsActive);

  useEffect(() => {
    if (containsActive) setOpen(true);
  }, [containsActive]);

  return (
    <SidebarMenuSubItem>
      <Collapsible open={open} onOpenChange={setOpen} className="group/collapsible">
        <CollapsibleTrigger
          render={
            <SidebarMenuSubButton
              render={<button type="button" />}
              size="sm"
              isActive={containsActive}
              className="h-6 text-muted-foreground data-active:text-sidebar-accent-foreground"
            >
              <span>{node.label}</span>
              <ChevronRight className={cn("ml-auto transition-transform", open && "rotate-90")} />
            </SidebarMenuSubButton>
          }
        />
        <CollapsibleContent>
          <ProjectDocumentTree nodes={node.children} activePath={activePath} navigate={navigate} pathFor={pathFor} level={level + 1} />
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuSubItem>
  );
}
