import { Activity, ChevronRight, FileKey2, Route, type LucideIcon } from "lucide-react";
import type { ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem
} from "@/components/ui/sidebar";
import { automationAllWorkflowsPath, automationSectionPath } from "../routing";
import type { AutomationTab, RouteState } from "../types";
import { SidebarCollapsibleLinkSection } from "./SidebarCollapsibleLinkSection";
import { SidebarNavLinkItem } from "./SidebarNavLinkItem";

function automationEntities(config: ProjectAutomationConfig, tab: AutomationTab): Array<{ id: string; label: string }> {
  if (tab === "actions") return config.actions.map((action) => ({ id: action.id, label: action.id }));
  return config.workflows.map((workflow) => ({ id: workflow.id, label: workflow.id }));
}

function activeAutomationEntityId(config: ProjectAutomationConfig, tab: AutomationTab, routeId?: string) {
  const entities = automationEntities(config, tab);
  return entities.some((entity) => entity.id === routeId) ? routeId : undefined;
}

type AutomationSidebarSection = { id: AutomationTab; label: string; icon: LucideIcon; emptyLabel: string };

const automationSidebarSections: AutomationSidebarSection[] = [
  { id: "actions", label: "Actions", icon: FileKey2, emptyLabel: "No actions." },
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
  const allWorkflowsActive = sectionActive && section.id === "workflows" && route.automationWorkflowView === "all";
  const sectionPath = automationSectionPath(section.id);
  const Icon = section.icon;

  return (
    <SidebarCollapsibleLinkSection
      label={section.label}
      icon={<Icon />}
      path={sectionPath}
      active={sectionActive}
      navigate={navigate}
      groupClassName="group/automation-section"
      chevronClassName="group-data-[state=open]/automation-section:rotate-90"
    >
      <SidebarMenuSub className="mx-2 gap-0.5 border-sidebar-border/60 px-2 py-1">
        {section.id === "workflows" ? (
          <SidebarNavLinkItem
            path={automationAllWorkflowsPath()}
            isActive={allWorkflowsActive}
            navigate={navigate}
            className="h-6 min-w-0 font-mono text-[0.7rem] text-muted-foreground data-active:text-sidebar-accent-foreground"
          >
            <span className="truncate">All workflows</span>
          </SidebarNavLinkItem>
        ) : null}
        {entities.length === 0 ? (
          <SidebarMenuSubItem>
            <span className="block px-2 py-1 text-xs text-muted-foreground">{section.emptyLabel}</span>
          </SidebarMenuSubItem>
        ) : null}
        {entities.map((entity) => {
          const path = automationSectionPath(section.id, entity.id);
          return (
            <SidebarNavLinkItem
              key={entity.id}
              path={path}
              isActive={sectionActive && entity.id === selectedId}
              navigate={navigate}
              className="h-6 min-w-0 font-mono text-[0.7rem] text-muted-foreground data-active:text-sidebar-accent-foreground"
            >
              <span className="truncate">{entity.label}</span>
            </SidebarNavLinkItem>
          );
        })}
      </SidebarMenuSub>
    </SidebarCollapsibleLinkSection>
  );
}

export function SidebarAutomationMenu({
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
        <CollapsibleTrigger
          render={
            <SidebarMenuButton
              isActive={automationOpen}
              tooltip="Automation"
              className="text-muted-foreground data-active:bg-transparent data-active:text-muted-foreground hover:text-sidebar-accent-foreground"
            >
              <Route />
              <span>Automation</span>
              <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
            </SidebarMenuButton>
          }
        />
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
