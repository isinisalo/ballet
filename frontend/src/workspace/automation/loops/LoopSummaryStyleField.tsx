import { useId } from "react";
import {
  loopSummaryStyleCatalog,
  loopSummaryStyles,
  type LoopSummaryStyle
} from "@shared/api/workspace-contracts";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { LoopSummaryArtwork } from "./LoopSummaryArtwork";

const summaryStyleItems = loopSummaryStyles.map((summaryStyle) => ({
  value: summaryStyle,
  label: loopSummaryStyleCatalog[summaryStyle].label
}));

export function LoopSummaryStyleField({
  value,
  disabled,
  onChange
}: {
  value: LoopSummaryStyle;
  disabled: boolean;
  onChange: (value: LoopSummaryStyle) => void;
}) {
  const fieldId = useId();

  return (
    <div className="flex items-center gap-1.5 rounded border border-divider-strong bg-card px-1.5">
      <label htmlFor={fieldId} className="whitespace-nowrap font-mono text-[0.62rem] uppercase text-muted-foreground">
        Loop style
      </label>
      <Select
        value={value}
        disabled={disabled}
        items={summaryStyleItems}
        onValueChange={(next) => { if (next) onChange(next as LoopSummaryStyle); }}
      >
        <SelectTrigger
          id={fieldId}
          size="sm"
          className="h-7 min-h-7 w-40 border-0 bg-transparent px-1.5 py-0 font-mono text-xs shadow-none dark:bg-transparent dark:hover:bg-input/30"
        >
          <LoopSummaryArtwork summaryStyle={value} size={18} />
          <span className="min-w-0 flex-1 truncate text-left">{loopSummaryStyleCatalog[value].label}</span>
        </SelectTrigger>
        <SelectContent align="end" className="min-w-44">
          {loopSummaryStyles.map((summaryStyle) => (
            <SelectItem key={summaryStyle} value={summaryStyle}>
              <LoopSummaryArtwork summaryStyle={summaryStyle} size={18} />
              {loopSummaryStyleCatalog[summaryStyle].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
