import { Activity, Bot, Boxes, ChevronDown, FileJson2, GitBranch, Home, ListTree, PlayCircle, Route, ScrollText, Settings2, Shapes, Sparkles, TerminalSquare } from "lucide-react";
import type React from "react";
import type { RouteState, AdvancedRoute, MainRoute } from "./routes";
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const mainItems: Array<{ route: MainRoute; label: string; icon: typeof Home; path: string }> = [
  { route: "overview", label: "Command Center", icon: Home, path: "/" },
  { route: "flows", label: "Flow Canvas", icon: Route, path: "/flows" },
  { route: "agents", label: "Agent Fleet", icon: Bot, path: "/agents" },
  { route: "runtime-console", label: "Runtime Console", icon: TerminalSquare, path: "/runtime-console" },
  { route: "knowledge", label: "Project Knowledge", icon: ScrollText, path: "/knowledge" },
  { route: "runs", label: "Runs", icon: Activity, path: "/runs" },
];

const advancedItems: Array<{ route: AdvancedRoute; label: string; icon: typeof Home; path: string }> = [
  { route: "contracts", label: "Data types", icon: Shapes, path: "/advanced/contracts" },
  { route: "events", label: "Events", icon: PlayCircle, path: "/advanced/events" },
  { route: "routing", label: "Routing rules", icon: GitBranch, path: "/advanced/routing" },
  { route: "emissions", label: "Emission rules", icon: Sparkles, path: "/advanced/emissions" },
  { route: "loops", label: "Loop definitions", icon: ListTree, path: "/advanced/loops" },
  { route: "runtimes", label: "Runtimes", icon: Settings2, path: "/advanced/runtimes" },
  { route: "skills", label: "Skills", icon: FileJson2, path: "/advanced/skills" }
];

export { SidebarProvider };

export function AppSidebar({ route, navigate }: { route: RouteState; navigate: (path: string) => void }) {
  const link = (path: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    navigate(path);
  };

  return (
    <ShadcnSidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="Ballet">
              <Boxes />
              <span className="flex flex-col gap-0.5">
                <span className="font-semibold">Ballet</span>
                <span className="text-xs text-muted-foreground">Agent OS</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.route}>
                    <SidebarMenuButton asChild isActive={route.main === item.route} tooltip={item.label}>
                      <a href={item.path} onClick={link(item.path)}>
                        <Icon />
                        <span>{item.label}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              <Collapsible defaultOpen={route.main === "advanced"} className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton isActive={route.main === "advanced"} tooltip="Advanced">
                      <Settings2 />
                      <span>Advanced</span>
                      <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {advancedItems.map((item) => {
                        const Icon = item.icon;
                        return (
                          <SidebarMenuSubItem key={item.route}>
                            <SidebarMenuSubButton asChild isActive={route.main === "advanced" && route.advanced === item.route}>
                              <a href={item.path} onClick={link(item.path)}>
                                <Icon />
                                <span>{item.label}</span>
                              </a>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter />
      <SidebarRail />
    </ShadcnSidebar>
  );
}
