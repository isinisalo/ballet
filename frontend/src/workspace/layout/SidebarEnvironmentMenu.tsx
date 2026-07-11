import { Bot, ChevronRight, Code2, FileKey2 } from "lucide-react";
import type { Agent, AgentExecutionState, Skill } from "@shared/api/workspace-contracts";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem
} from "@/components/ui/sidebar";
import { runtimePath, skillDocumentPath } from "../routing";
import type { RouteState } from "../types";
import { SidebarAgentList } from "./SidebarAgentList";
import { SidebarCollapsibleLinkSection } from "./SidebarCollapsibleLinkSection";
import { SidebarDocumentList } from "./SidebarDocumentList";

function SidebarRuntimesSection({ route, navigate }: { route: RouteState; navigate: (path: string) => void }) {
  const runtimesOpen = route.view === "runtimes";
  const rootPath = runtimePath();

  return (
    <SidebarCollapsibleLinkSection
      label="Runtimes"
      icon={<Code2 />}
      path={rootPath}
      active={runtimesOpen}
      navigate={navigate}
      groupClassName="group/environment-section"
      chevronClassName="group-data-[state=open]/environment-section:rotate-90"
    >
      <SidebarMenuSub className="mx-2 gap-0.5 border-sidebar-border/60 px-2 py-1">
        <SidebarMenuSubItem><span className="block px-2 py-1.5 text-xs text-muted-foreground">Device registry</span></SidebarMenuSubItem>
      </SidebarMenuSub>
    </SidebarCollapsibleLinkSection>
  );
}

export function SidebarEnvironmentMenu({
  route,
  agents,
  agentExecutionStates,
  skills,
  navigate
}: {
  route: RouteState;
  agents: Agent[];
  agentExecutionStates: AgentExecutionState[];
  skills: Skill[];
  navigate: (path: string) => void;
}) {
  const environmentOpen = route.view === "agents" || route.view === "skills" || route.view === "runtimes";
  const agentsOpen = route.view === "agents";
  const skillsOpen = route.view === "skills";

  return (
    <Collapsible defaultOpen={environmentOpen} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger
          render={
            <SidebarMenuButton
              isActive={environmentOpen}
              tooltip="Environment"
              className="text-muted-foreground data-active:bg-transparent data-active:text-muted-foreground hover:text-sidebar-accent-foreground"
            >
              <Code2 />
              <span>Environment</span>
              <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
            </SidebarMenuButton>
          }
        />
        <CollapsibleContent>
          <SidebarMenuSub>
            <SidebarCollapsibleLinkSection label="Agents" icon={<Bot />} path="/agents" active={agentsOpen} navigate={navigate} groupClassName="group/environment-section" chevronClassName="group-data-[state=open]/environment-section:rotate-90">
              <SidebarAgentList agents={agents} executionStates={agentExecutionStates} activePath={agentsOpen ? route.documentPath : undefined} navigate={navigate} />
            </SidebarCollapsibleLinkSection>
            <SidebarCollapsibleLinkSection label="Skills" icon={<FileKey2 />} path="/skills" active={skillsOpen} navigate={navigate} groupClassName="group/environment-section" chevronClassName="group-data-[state=open]/environment-section:rotate-90">
              <SidebarDocumentList documents={skills} activePath={skillsOpen ? route.documentPath : undefined} pathFor={skillDocumentPath} navigate={navigate} />
            </SidebarCollapsibleLinkSection>
            <SidebarRuntimesSection route={route} navigate={navigate} />
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}
