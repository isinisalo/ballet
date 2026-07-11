import { FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { AgentNodeStyle } from "@shared/api/workspace-contracts";

export type AgentNodeStyleSettings = {
  nodeStyle?: AgentNodeStyle;
  nodeStyleSaving: boolean;
  nodeStyleError?: string;
  onNodeStyleChange?: (style: AgentNodeStyle) => void;
};

export function AgentNodeStyleField({ nodeStyle, nodeStyleSaving, nodeStyleError, onNodeStyleChange, compact = false }: AgentNodeStyleSettings & { compact?: boolean }) {
  if (!nodeStyle || !onNodeStyleChange) return null;
  return (
    <div className={compact ? "grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-3 text-xs leading-4" : "grid gap-1.5 sm:max-w-xs"}>
      <FieldLabel className="text-muted-foreground">Node style</FieldLabel>
      <div className="grid gap-1">
        <Select value={nodeStyle} disabled={nodeStyleSaving} onValueChange={(value) => onNodeStyleChange(value as AgentNodeStyle)}>
          <SelectTrigger aria-label="Node style" className={cn("w-full font-mono text-xs", compact && "h-8")}><SelectValue /></SelectTrigger>
          <SelectContent align="start"><SelectGroup>
            <SelectItem value="luna">Luna</SelectItem>
            <SelectItem value="terra">Terra</SelectItem>
            <SelectItem value="sol">Sol</SelectItem>
          </SelectGroup></SelectContent>
        </Select>
        {nodeStyleError ? <span role="alert" className="text-[0.65rem] leading-4 text-destructive">{nodeStyleError}</span> : null}
      </div>
    </div>
  );
}
