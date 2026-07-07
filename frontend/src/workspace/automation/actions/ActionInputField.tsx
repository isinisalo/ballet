import type { ActionInputSource } from "./actionInputSources";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Field, FieldLabel } from "@/components/ui/field";

export function ActionInputField({ sources }: { sources: ActionInputSource[] }) {
  return (
    <Field>
      <FieldLabel>Input</FieldLabel>
      <div className="flex min-h-7 flex-wrap items-center gap-2">
        {sources.length > 0 ? sources.map((source, index) => (
          <Badge
            key={`${source.type}:${source.id}:${index}`}
            variant="outline"
            className={cn(
              "min-w-0 font-mono",
              source.type === "trigger"
                ? "border-tertiary/60 bg-tertiary/10 text-tertiary"
                : "border-primary/60 bg-primary/10 text-primary"
            )}
          >
            <span className="truncate">{source.label}</span>
          </Badge>
        )) : <span className="text-sm text-muted-foreground">None</span>}
      </div>
    </Field>
  );
}
