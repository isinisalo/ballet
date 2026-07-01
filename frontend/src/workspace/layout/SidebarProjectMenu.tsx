import { type ReactNode } from "react";
import { Archive, CheckCircle2, ChevronRight, FileText } from "lucide-react";
import type { ProjectDocumentTreeNode } from "../../../../shared/api/workspace-contracts";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem
} from "@/components/ui/sidebar";
import { findProjectTreeDirectory, projectTreeContainsPath, type ProjectTreeDirectory } from "../documents/projectDocuments";
import { projectCollectionDocumentPath, projectDocumentPath } from "../routing";
import type { ProjectDocumentCreateKind, RouteState } from "../types";
import { ProjectDocumentTree } from "./ProjectDocumentTree";

export function SidebarProjectMenu({
  route,
  projectId,
  projectDocumentTree,
  navigate
}: {
  route: RouteState;
  projectId?: string;
  projectDocumentTree: ProjectDocumentTreeNode[];
  navigate: (path: string) => void;
}) {
  const projectOpen = route.view === "projects" || route.view === "project-document" || route.view === "project-goals" || route.view === "project-adrs" || route.view === "project-instructions";
  const adrDirectory = findProjectTreeDirectory(projectDocumentTree, ".ballet/adr");
  const goalsDirectory = findProjectTreeDirectory(projectDocumentTree, ".ballet/goals");
  const instructionsDirectory = findProjectTreeDirectory(projectDocumentTree, ".ballet/instructions");
  const projectPathFor = (kind: ProjectDocumentCreateKind) => (relativePath: string) =>
    projectId ? projectCollectionDocumentPath(projectId, kind, relativePath) : projectDocumentPath(relativePath);

  return (
    <Collapsible defaultOpen={projectOpen} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            isActive={projectOpen}
            tooltip="Project"
            className="text-muted-foreground data-active:bg-transparent data-active:text-muted-foreground hover:text-sidebar-accent-foreground"
          >
            <FileText />
            <span>Project</span>
            <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            <SidebarProjectDirectoryMenu
              label="ADR"
              icon={<Archive />}
              node={adrDirectory}
              activePath={route.documentPath}
              navigate={navigate}
              pathFor={projectPathFor("adr")}
              activeView={route.view === "project-adrs"}
            />
            <SidebarProjectDirectoryMenu
              label="Goals"
              icon={<CheckCircle2 />}
              node={goalsDirectory}
              activePath={route.documentPath}
              navigate={navigate}
              pathFor={projectPathFor("goal")}
              activeView={route.view === "project-goals"}
            />
            <SidebarProjectDirectoryMenu
              label="Instructions"
              icon={<FileText />}
              node={instructionsDirectory}
              activePath={route.documentPath}
              navigate={navigate}
              pathFor={projectPathFor("instruction")}
              forceRender
              emptyLabel="No instructions."
              activeView={route.view === "project-instructions"}
            />
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

function SidebarProjectDirectoryMenu({
  label,
  icon,
  node,
  activePath,
  navigate,
  pathFor = projectDocumentPath,
  emptyLabel,
  forceRender = false,
  activeView = false
}: {
  label: string;
  icon: ReactNode;
  node?: ProjectTreeDirectory;
  activePath?: string;
  navigate: (path: string) => void;
  pathFor?: (relativePath: string) => string;
  emptyLabel?: string;
  forceRender?: boolean;
  activeView?: boolean;
}) {
  const children = node?.children ?? [];
  const active = activeView || projectTreeContainsPath(children, activePath);

  if (!node && !forceRender) return null;

  return (
    <Collapsible defaultOpen={active} className="group/project-section">
      <SidebarMenuSubItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuSubButton
            asChild
            size="sm"
            isActive={active}
            className="h-6 min-w-0 text-muted-foreground data-active:text-sidebar-accent-foreground"
          >
            <button type="button">
              {icon}
              <span>{label}</span>
              <ChevronRight className="ml-auto transition-transform group-data-[state=open]/project-section:rotate-90" />
            </button>
          </SidebarMenuSubButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {children.length > 0 ? (
            <ProjectDocumentTree nodes={children} activePath={activePath} navigate={navigate} pathFor={pathFor} />
          ) : emptyLabel ? (
            <SidebarMenuSub>
              <SidebarMenuSubItem>
                <span className="block px-2 py-1.5 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                  {emptyLabel}
                </span>
              </SidebarMenuSubItem>
            </SidebarMenuSub>
          ) : null}
        </CollapsibleContent>
      </SidebarMenuSubItem>
    </Collapsible>
  );
}
