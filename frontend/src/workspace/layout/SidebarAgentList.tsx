import type { Agent } from "../../../../shared/api/workspace-contracts";
import {
  SidebarMenuSub
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { agentDocumentPath } from "../routing";
import { SidebarNavLinkItem } from "./SidebarNavLinkItem";

type SidebarAgentEntity = Pick<Agent, "id" | "name" | "relativePath" | "status">;

export function SidebarAgentList({
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
          <SidebarNavLinkItem
            key={agent.id}
            path={path}
            isActive={relativePath === activePath}
            navigate={navigate}
            className="h-6 min-w-0 text-muted-foreground data-active:text-sidebar-accent-foreground"
          >
            <AgentStatusDot status={agent.status} />
            <span className="truncate">{agent.name}</span>
          </SidebarNavLinkItem>
        );
      })}
    </SidebarMenuSub>
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
