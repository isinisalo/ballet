import { useEffect, useState, type ReactNode } from "react";
import {
  Activity,
  Archive,
  Bot,
  CheckCircle2,
  ChevronRight,
  Code2,
  FileKey2,
  FileText,
  Route,
  Zap,
  type LucideIcon
} from "lucide-react";
import type { Agent } from "../../../../shared/api/workspace-contracts";
import type { ProjectAutomationConfig } from "../../../../shared/api/workspace-contracts";
import type { ProjectDocumentTreeNode, Skill } from "../../../../shared/api/workspace-contracts";
import type { ProjectRuntime } from "../../../../shared/api/workspace-contracts";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { agentDocumentPath, automationSectionPath, projectCollectionDocumentPath, projectDocumentPath, runtimePath, skillDocumentPath } from "../routing";
import type { AutomationTab, ProjectDocumentCreateKind, RouteState } from "../types";
import { findProjectTreeDirectory, projectTreeContainsPath, type ProjectTreeDirectory } from "../documents/projectDocuments";

function ProjectDocumentTree({
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
            <SidebarMenuSubItem key={node.document.relativePath}>
              <SidebarMenuSubButton
                href={path}
                size="sm"
                isActive={node.document.relativePath === activePath}
                className="h-6 text-muted-foreground data-active:text-sidebar-accent-foreground"
                onClick={(event) => {
                  event.preventDefault();
                  navigate(path);
                }}
              >
                <span>{node.label}</span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
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
        <CollapsibleTrigger asChild>
          <SidebarMenuSubButton
            asChild
            size="sm"
            isActive={containsActive}
            className="h-6 text-muted-foreground data-active:text-sidebar-accent-foreground"
          >
            <button type="button">
              <span>{node.label}</span>
              <ChevronRight className={cn("ml-auto transition-transform", open && "rotate-90")} />
            </button>
          </SidebarMenuSubButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ProjectDocumentTree nodes={node.children} activePath={activePath} navigate={navigate} pathFor={pathFor} level={level + 1} />
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuSubItem>
  );
}

type SidebarDocumentEntity = Pick<Agent | Skill, "id" | "name" | "relativePath">;
type SidebarAgentEntity = Pick<Agent, "id" | "name" | "relativePath" | "status">;

function SidebarDocumentList({
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
          <SidebarMenuSubItem key={document.id}>
            <SidebarMenuSubButton
              href={path}
              size="sm"
              isActive={relativePath === activePath}
              className="h-6 min-w-0 text-muted-foreground data-active:text-sidebar-accent-foreground"
              onClick={(event) => {
                event.preventDefault();
                navigate(path);
              }}
            >
              <span className="truncate">{document.name}</span>
            </SidebarMenuSubButton>
          </SidebarMenuSubItem>
        );
      })}
    </SidebarMenuSub>
  );
}

function SidebarAgentList({
  agents,
  activePath,
  navigate
}: {
  agents: SidebarAgentEntity[];
  activePath?: string;
  navigate: (path: string) => void;
}) {
  if (agents.length === 0) return null;

  return (
    <SidebarMenuSub>
      {agents.map((agent) => {
        const relativePath = agent.relativePath;
        if (!relativePath) return null;
        const path = agentDocumentPath(relativePath);
        return (
          <SidebarMenuSubItem key={agent.id}>
            <SidebarMenuSubButton
              href={path}
              size="sm"
              isActive={relativePath === activePath}
              className="h-6 min-w-0 text-muted-foreground data-active:text-sidebar-accent-foreground"
              onClick={(event) => {
                event.preventDefault();
                navigate(path);
              }}
            >
              <AgentStatusDot status={agent.status} />
              <span className="truncate">{agent.name}</span>
            </SidebarMenuSubButton>
          </SidebarMenuSubItem>
        );
      })}
    </SidebarMenuSub>
  );
}

function automationEntities(config: ProjectAutomationConfig, tab: AutomationTab): Array<{ id: string; label: string }> {
  if (tab === "actions") return config.actions.map((action) => ({ id: action.id, label: action.id }));
  if (tab === "triggers") return config.triggers.map((trigger) => ({ id: trigger.id, label: trigger.id }));
  return config.workflows.map((workflow) => ({ id: workflow.id, label: workflow.id }));
}

function activeAutomationEntityId(config: ProjectAutomationConfig, tab: AutomationTab, routeId?: string) {
  const entities = automationEntities(config, tab);
  return entities.some((entity) => entity.id === routeId) ? routeId : entities[0]?.id ?? "";
}

type AutomationSidebarSection = { id: AutomationTab; label: string; icon: LucideIcon; emptyLabel: string };

const automationSidebarSections: AutomationSidebarSection[] = [
  { id: "actions", label: "Actions", icon: FileKey2, emptyLabel: "No actions." },
  { id: "triggers", label: "Triggers", icon: Zap, emptyLabel: "No triggers." },
  { id: "workflows", label: "Workflows", icon: Activity, emptyLabel: "No workflows." }
];

function SidebarAutomationSection({
  section,
  automation,
  route,
  navigate
}: {
  section: AutomationSidebarSection;
  automation: ProjectAutomationConfig;
  route: RouteState;
  navigate: (path: string) => void;
}) {
  const entities = automationEntities(automation, section.id);
  const selectedId = activeAutomationEntityId(automation, section.id, route.automationTab === section.id ? route.automationEntityId : undefined);
  const sectionActive = route.view === "automation" && route.automationTab === section.id;
  const sectionPath = automationSectionPath(section.id, selectedId || undefined);
  const Icon = section.icon;
  const [open, setOpen] = useState(sectionActive);

  useEffect(() => {
    if (sectionActive) setOpen(true);
  }, [sectionActive]);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="group/automation-section">
      <SidebarMenuSubItem>
        <SidebarMenuSubButton
          href={sectionPath}
          size="sm"
          isActive={sectionActive}
          aria-expanded={open}
          className="h-6 min-w-0 text-muted-foreground data-active:text-sidebar-accent-foreground"
          onClick={(event) => {
            event.preventDefault();
            setOpen((current) => !current);
            navigate(sectionPath);
          }}
        >
          <Icon />
          <span>{section.label}</span>
          <ChevronRight className="ml-auto transition-transform group-data-[state=open]/automation-section:rotate-90" />
        </SidebarMenuSubButton>
        <CollapsibleContent>
          <SidebarMenuSub className="mx-2 gap-0.5 border-sidebar-border/60 px-2 py-1">
            {entities.length === 0 ? (
              <SidebarMenuSubItem>
                <span className="block px-2 py-1 text-xs text-muted-foreground">{section.emptyLabel}</span>
              </SidebarMenuSubItem>
            ) : null}
            {entities.map((entity) => {
              const path = automationSectionPath(section.id, entity.id);
              return (
                <SidebarMenuSubItem key={entity.id}>
                  <SidebarMenuSubButton
                    href={path}
                    size="sm"
                    isActive={sectionActive && entity.id === selectedId}
                    className="h-6 min-w-0 font-mono text-[0.7rem] text-muted-foreground data-active:text-sidebar-accent-foreground"
                    onClick={(event) => {
                      event.preventDefault();
                      navigate(path);
                    }}
                  >
                    <span className="truncate">{entity.label}</span>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuSubItem>
    </Collapsible>
  );
}

function SidebarAutomationMenu({
  route,
  automation,
  navigate
}: {
  route: RouteState;
  automation: ProjectAutomationConfig;
  navigate: (path: string) => void;
}) {
  const automationOpen = route.view === "automation";

  return (
    <Collapsible defaultOpen={automationOpen} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            isActive={automationOpen}
            tooltip="Automation"
            className="text-muted-foreground data-active:bg-transparent data-active:text-muted-foreground hover:text-sidebar-accent-foreground"
          >
            <Route />
            <span>Automation</span>
            <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {automationSidebarSections.map((section) => (
              <SidebarAutomationSection key={section.id} section={section} automation={automation} route={route} navigate={navigate} />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

function SidebarRuntimesSection({
  route,
  runtimes,
  navigate
}: {
  route: RouteState;
  runtimes: ProjectRuntime[];
  navigate: (path: string) => void;
}) {
  const runtimesOpen = route.view === "runtimes";
  const selectedId = runtimes.some((runtime) => runtime.id === route.runtimeId) ? route.runtimeId : runtimes[0]?.id ?? "";
  const rootPath = runtimePath(selectedId || undefined);
  const [open, setOpen] = useState(runtimesOpen);

  useEffect(() => {
    if (runtimesOpen) setOpen(true);
  }, [runtimesOpen]);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="group/environment-section">
      <SidebarMenuSubItem>
        <SidebarMenuSubButton
          href={rootPath}
          size="sm"
          isActive={runtimesOpen}
          aria-expanded={open}
          className="h-6 min-w-0 text-muted-foreground data-active:text-sidebar-accent-foreground"
          onClick={(event) => {
            event.preventDefault();
            setOpen((current) => !current);
            navigate(rootPath);
          }}
        >
          <Code2 />
          <span>Runtimes</span>
          <ChevronRight className="ml-auto transition-transform group-data-[state=open]/environment-section:rotate-90" />
        </SidebarMenuSubButton>
        <CollapsibleContent>
          <SidebarMenuSub className="mx-2 gap-0.5 border-sidebar-border/60 px-2 py-1">
            {runtimes.length === 0 ? (
              <SidebarMenuSubItem>
                <span className="block px-2 py-1.5 text-xs text-muted-foreground">No runtimes.</span>
              </SidebarMenuSubItem>
            ) : null}
            {runtimes.map((runtime) => {
              const path = runtimePath(runtime.id);
              return (
                <SidebarMenuSubItem key={runtime.id}>
                  <SidebarMenuSubButton
                    href={path}
                    size="sm"
                    isActive={runtimesOpen && runtime.id === selectedId}
                    className="h-6 min-w-0 font-mono text-[0.7rem] text-muted-foreground data-active:text-sidebar-accent-foreground"
                    onClick={(event) => {
                      event.preventDefault();
                      navigate(path);
                    }}
                  >
                    <span className="truncate">{runtime.id}</span>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuSubItem>
    </Collapsible>
  );
}

function SidebarEnvironmentSection({
  label,
  icon,
  path,
  active,
  children,
  navigate
}: {
  label: string;
  icon: ReactNode;
  path: string;
  active: boolean;
  children: ReactNode;
  navigate: (path: string) => void;
}) {
  const [open, setOpen] = useState(active);

  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="group/environment-section">
      <SidebarMenuSubItem>
        <SidebarMenuSubButton
          href={path}
          size="sm"
          isActive={active}
          aria-expanded={open}
          className="h-6 min-w-0 text-muted-foreground data-active:text-sidebar-accent-foreground"
          onClick={(event) => {
            event.preventDefault();
            setOpen((current) => !current);
            navigate(path);
          }}
        >
          {icon}
          <span>{label}</span>
          <ChevronRight className="ml-auto transition-transform group-data-[state=open]/environment-section:rotate-90" />
        </SidebarMenuSubButton>
        <CollapsibleContent>
          {children}
        </CollapsibleContent>
      </SidebarMenuSubItem>
    </Collapsible>
  );
}

function SidebarEnvironmentMenu({
  route,
  agents,
  skills,
  runtimes,
  navigate
}: {
  route: RouteState;
  agents: Agent[];
  skills: Skill[];
  runtimes: ProjectRuntime[];
  navigate: (path: string) => void;
}) {
  const environmentOpen = route.view === "agents" || route.view === "skills" || route.view === "runtimes";
  const agentsOpen = route.view === "agents";
  const skillsOpen = route.view === "skills";

  return (
    <Collapsible defaultOpen={environmentOpen} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            isActive={environmentOpen}
            tooltip="Environment"
            className="text-muted-foreground data-active:bg-transparent data-active:text-muted-foreground hover:text-sidebar-accent-foreground"
          >
            <Code2 />
            <span>Environment</span>
            <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            <SidebarEnvironmentSection label="Agents" icon={<Bot />} path="/agents" active={agentsOpen} navigate={navigate}>
              <SidebarAgentList agents={agents} activePath={agentsOpen ? route.documentPath : undefined} navigate={navigate} />
            </SidebarEnvironmentSection>
            <SidebarEnvironmentSection label="Skills" icon={<FileKey2 />} path="/skills" active={skillsOpen} navigate={navigate}>
              <SidebarDocumentList documents={skills} activePath={skillsOpen ? route.documentPath : undefined} pathFor={skillDocumentPath} navigate={navigate} />
            </SidebarEnvironmentSection>
            <SidebarRuntimesSection route={route} runtimes={runtimes} navigate={navigate} />
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

function SidebarProjectMenu({
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

function AgentStatusDot({ status }: { status: Agent["status"] }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "size-2 shrink-0 rounded-full",
        status === "online" ? "bg-secondary shadow-[0_0_0_3px] shadow-secondary/15" : "bg-muted-foreground/45"
      )}
    />
  );
}

export function AppSidebar({
  route,
  projectId,
  projectDocumentTree,
  automation,
  agents,
  skills,
  navigate
}: {
  route: RouteState;
  projectId?: string;
  projectDocumentTree: ProjectDocumentTreeNode[];
  automation: ProjectAutomationConfig;
  agents: Agent[];
  skills: Skill[];
  navigate: (path: string) => void;
}) {
  return (
    <ShadcnSidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="AgentOps">
              <Route />
              <span className="flex flex-col gap-0.5">
                <span className="font-semibold">AgentOps</span>
                <span className="text-xs text-muted-foreground">MVP control plane</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarProjectMenu route={route} projectId={projectId} projectDocumentTree={projectDocumentTree} navigate={navigate} />
              <SidebarAutomationMenu route={route} automation={automation} navigate={navigate} />
              <SidebarEnvironmentMenu route={route} agents={agents} skills={skills} runtimes={automation.runtimes} navigate={navigate} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </ShadcnSidebar>
  );
}
