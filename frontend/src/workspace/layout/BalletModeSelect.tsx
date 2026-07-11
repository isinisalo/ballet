import type { BalletMode } from "@shared/api/workspace-contracts";
import { Play, Settings2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function BalletModeSelect({ mode, onChange }: {
  mode: BalletMode;
  onChange: (mode: BalletMode) => void;
}) {
  return (
    <Select<BalletMode> value={mode} onValueChange={onChange}>
      <SelectTrigger aria-label="Ballet mode" className="h-9 w-full border-sidebar-border bg-sidebar-accent/45 px-2.5 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:px-2">
        {mode === "configure" ? <Settings2 /> : <Play />}
        <SelectValue className="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.04em] group-data-[collapsible=icon]:hidden" />
      </SelectTrigger>
      <SelectContent align="start">
        <SelectItem value="configure"><Settings2 /> Ballet Configure</SelectItem>
        <SelectItem value="run"><Play /> Ballet Run</SelectItem>
      </SelectContent>
    </Select>
  );
}
