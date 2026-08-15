import { ChevronRight, Code2, Cpu, FileKey2 } from "lucide-react";
import type { ExecutionProfile, Skill } from "@shared/api/workspace-contracts";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem
} from "@/components/ui/sidebar";
import { executionProfilePath, runtimePath, skillDocumentPath } from "../routing";
import type { RouteState } from "../types";
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
        <SidebarMenuSubItem><span className="block px-2 py-1.5 text-xs text-muted-foreground">Local CLI</span></SidebarMenuSubItem>
      </SidebarMenuSub>
    </SidebarCollapsibleLinkSection>
  );
}

export function SidebarEnvironmentMenu({
  route,
  executionProfiles,
  skills,
  navigate
}: {
  route: RouteState;
  executionProfiles: ExecutionProfile[];
  skills: Skill[];
  navigate: (path: string) => void;
}) {
  const environmentOpen = route.view === "execution-profiles" || route.view === "skills" || route.view === "runtimes";
  const profilesOpen = route.view === "execution-profiles";
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
            <SidebarCollapsibleLinkSection label="Execution profiles" icon={<Cpu />} path={executionProfilePath()} active={profilesOpen} navigate={navigate} groupClassName="group/environment-section" chevronClassName="group-data-[state=open]/environment-section:rotate-90">
              <SidebarMenuSub className="mx-2 gap-0.5 border-sidebar-border/60 px-2 py-1">
                {executionProfiles.length === 0 ? <SidebarMenuSubItem><span className="block px-2 py-1.5 text-xs text-muted-foreground">No profiles.</span></SidebarMenuSubItem> : executionProfiles.map((profile) => (
                  <SidebarMenuSubItem key={profile.id}>
                    <SidebarMenuButton
                      isActive={profilesOpen && route.executionProfileId === profile.id}
                      className="h-7 min-w-0 font-mono text-[0.7rem]"
                      onClick={() => navigate(executionProfilePath(profile.id))}
                    >
                      <span className="truncate">{profile.name}</span>
                    </SidebarMenuButton>
                  </SidebarMenuSubItem>
                ))}
              </SidebarMenuSub>
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
