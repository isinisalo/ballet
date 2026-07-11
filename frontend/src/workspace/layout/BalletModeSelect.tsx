import type { BalletMode } from "@shared/api/workspace-contracts";
import { Route } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function BalletModeSelect({ mode, onChange }: {
  mode: BalletMode;
  onChange: (mode: BalletMode) => void;
}) {
  return (
    <Select<BalletMode> value={mode} onValueChange={onChange}>
      <SelectTrigger
        aria-label="Ballet mode"
        title="Ballet"
        className="h-8 w-fit min-w-0 gap-1.5 rounded-lg border-transparent bg-transparent px-2 font-semibold text-sidebar-foreground transition-colors hover:border-sidebar-border/70 hover:bg-sidebar-accent focus-visible:border-sidebar-border/70 focus-visible:bg-sidebar-accent data-[popup-open]:border-sidebar-border/70 data-[popup-open]:bg-sidebar-accent group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:hover:border-transparent group-data-[collapsible=icon]:hover:bg-sidebar-accent [&>svg:last-child]:hidden hover:[&>svg:last-child]:block focus-visible:[&>svg:last-child]:block data-[popup-open]:[&>svg:last-child]:block group-data-[collapsible=icon]:[&>svg:last-child]:hidden"
      >
        <Route className="hidden group-data-[collapsible=icon]:block" aria-hidden="true" />
        <SelectValue className="group-data-[collapsible=icon]:hidden">Ballet</SelectValue>
      </SelectTrigger>
      <SelectContent align="start" className="w-60 min-w-60 border border-sidebar-border p-1.5">
        <SelectItem value="run" className="items-start rounded-md px-2.5 py-2.5">
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-sm font-medium leading-5">Run</span>
            <span className="text-xs leading-4 text-muted-foreground">Launch and monitor active work</span>
          </span>
        </SelectItem>
        <SelectItem value="configure" className="items-start rounded-md px-2.5 py-2.5">
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-sm font-medium leading-5">Configure</span>
            <span className="text-xs leading-4 text-muted-foreground">Define projects, agents, and automation</span>
          </span>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
