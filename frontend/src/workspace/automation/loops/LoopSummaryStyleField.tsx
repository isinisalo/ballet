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
  return (
    <Select
      value={value}
      disabled={disabled}
      items={summaryStyleItems}
      onValueChange={(next) => { if (next) onChange(next as LoopSummaryStyle); }}
    >
      <SelectTrigger
        size="sm"
        aria-label="Loop style"
        title={`Loop style: ${loopSummaryStyleCatalog[value].label}`}
        className="size-7 min-h-7 shrink-0 border-0 bg-transparent p-0 text-primary shadow-none dark:bg-transparent dark:hover:bg-input/30 [&>svg:last-child]:hidden"
      >
        <LoopSummaryArtwork summaryStyle={value} size={24} />
      </SelectTrigger>
      <SelectContent align="start" className="min-w-44">
        {loopSummaryStyles.map((summaryStyle) => (
          <SelectItem key={summaryStyle} value={summaryStyle}>
            <LoopSummaryArtwork summaryStyle={summaryStyle} size={18} />
            {loopSummaryStyleCatalog[summaryStyle].label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
