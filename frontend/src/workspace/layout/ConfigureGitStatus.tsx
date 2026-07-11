import { Check, GitCompare } from "lucide-react";
import {
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem
} from "@/components/ui/sidebar";

export type ConfigureGitState = {
  clean: boolean;
  changeCount: number;
  paths: string[];
};

export function ConfigureGitStatus({ state }: { state?: ConfigureGitState }) {
  if (!state) return null;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton tooltip={state.clean ? "clean" : `${state.changeCount} config changes`} className="text-muted-foreground">
        {state.clean ? <Check className="text-secondary" /> : <GitCompare className="text-tertiary" />}
        <span className="font-mono text-[0.68rem]">{state.clean ? "clean" : `${state.changeCount} config changes`}</span>
      </SidebarMenuButton>
      {!state.clean && state.paths.length > 0 ? (
        <SidebarMenuSub className="gap-0">
          {state.paths.map((path) => <SidebarMenuSubItem key={path}><span className="block truncate px-2 py-1 font-mono text-[0.6rem] text-muted-foreground" title={path}>{path}</span></SidebarMenuSubItem>)}
        </SidebarMenuSub>
      ) : null}
    </SidebarMenuItem>
  );
}
