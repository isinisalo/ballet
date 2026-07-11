import { TriangleAlert } from "lucide-react";
import type { RuntimeConfigurationIssue } from "@shared/api/workspace-contracts";
import { SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubItem } from "@/components/ui/sidebar";

export function ConfigureRuntimeIssues({ issues }: { issues: RuntimeConfigurationIssue[] }) {
  if (issues.length === 0) return null;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton tooltip={`${issues.length} runtime config issues`} className="text-destructive">
        <TriangleAlert /><span className="font-mono text-[0.68rem]">{issues.length} runtime config issues</span>
      </SidebarMenuButton>
      <SidebarMenuSub className="gap-0">
        {issues.map((issue, index) => <SidebarMenuSubItem key={`${issue.code}:${issue.path}:${issue.agentId ?? index}`}><span className="block px-2 py-1 font-mono text-[0.6rem] text-destructive" title={`${issue.path}: ${issue.message}`}>{issue.path}: {issue.message}</span></SidebarMenuSubItem>)}
      </SidebarMenuSub>
    </SidebarMenuItem>
  );
}
