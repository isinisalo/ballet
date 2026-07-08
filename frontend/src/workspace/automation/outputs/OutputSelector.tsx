import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  nextSelectedOutputIds,
  normalizeOutputId,
  outputCanCreate,
  outputIdMaxLength,
  outputSuggestions,
  outputValidationMessage,
  uniqueOutputIds,
  type OutputId
} from "./outputSelectorUtils";

type OutputSelectorProps = {
  value: OutputId[];
  onChange: (value: OutputId[]) => void;
  initialOptions: OutputId[];
  blockedOptions?: OutputId[];
  max?: number;
  replaceWhenFull?: boolean;
  openButtonLabel?: string;
  canRemove?: boolean;
  disabled?: boolean;
  displayByOutputId?: Record<OutputId, { type: "event"; label: string }>;
  onCreateOption?: (id: OutputId) => void;
};

export function OutputSelector({
  value,
  onChange,
  initialOptions,
  blockedOptions = [],
  max = 3,
  replaceWhenFull = false,
  openButtonLabel,
  canRemove = true,
  disabled = false,
  displayByOutputId = {},
  onCreateOption
}: OutputSelectorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [createdOptions, setCreatedOptions] = useState<OutputId[]>([]);
  const selected = useMemo(() => uniqueOutputIds(value, max), [max, value]);
  const blocked = useMemo(() => uniqueOutputIds(blockedOptions), [blockedOptions]);
  const options = useMemo(() => uniqueOutputIds([...initialOptions, ...createdOptions, ...selected]), [createdOptions, initialOptions, selected]);
  const suggestions = useMemo(() => outputSuggestions(options, [...selected, ...blocked], query), [blocked, options, query, selected]);
  const normalizedQuery = normalizeOutputId(query);
  const validationMessage = query ? outputValidationMessage(query) : undefined;
  const canCreate = query ? outputCanCreate(query, options, [...selected, ...blocked]) : false;
  const atLimit = selected.length >= max;
  const canOpenEditor = !disabled && (!atLimit || replaceWhenFull);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const closeEditor = () => {
    setEditing(false);
    setQuery("");
  };

  const selectOutput = (outputId: string) => {
    const normalized = normalizeOutputId(outputId);
    if (!normalized || blocked.includes(normalized)) return;
    if (selected.length >= max) {
      if (!replaceWhenFull || max !== 1) return;
      onChange([normalized]);
    } else {
      onChange(nextSelectedOutputIds(selected, normalized, max));
    }
    closeEditor();
  };

  const createOutput = () => {
    if (!canCreate || !normalizedQuery) return;
    if (selected.length >= max && (!replaceWhenFull || max !== 1)) return;
    setCreatedOptions((current) => uniqueOutputIds([...current, normalizedQuery]));
    onCreateOption?.(normalizedQuery);
    onChange(selected.length >= max ? [normalizedQuery] : nextSelectedOutputIds(selected, normalizedQuery, max));
    closeEditor();
  };

  const removeOutput = (outputId: string) => {
    onChange(selected.filter((candidate) => candidate !== outputId));
  };

  const submitQuery = () => {
    if (suggestions[0]) {
      selectOutput(suggestions[0]);
      return;
    }
    createOutput();
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-7 flex-wrap items-center gap-2">
        {selected.map((outputId) => {
          const display = displayByOutputId[outputId];
          return (
            <Badge
              key={outputId}
              variant="outline"
              className={cn(
                "min-w-0 font-mono",
                display
                  ? "border-primary/60 bg-primary/10 text-primary"
                  : "border-divider-strong bg-muted/50"
              )}
            >
              <span className="truncate">{display?.label ?? outputId}</span>
              {canRemove ? (
                <Button
                  type="button" size="icon-xs" variant="ghost"
                  aria-label={`Remove output ${outputId}`}
                  title={`Remove output ${outputId}`}
                  disabled={disabled}
                  onClick={() => removeOutput(outputId)}
                  className="-mr-1 size-4 rounded-full p-0"
                >
                  <X data-icon="inline-end" />
                </Button>
              ) : null}
            </Badge>
          );
        })}
        {!editing && canOpenEditor ? (
          <Button
            type="button" size="xs" variant="outline"
            aria-label={openButtonLabel ?? "Add output"}
            disabled={disabled}
            onClick={() => setEditing(true)}
            className="h-5 rounded-xl border-dashed border-divider-strong bg-transparent px-2 py-0.5 font-mono text-xs text-muted-foreground shadow-none hover:bg-muted"
          >
            <Plus data-icon="inline-start" />
            Output
          </Button>
        ) : null}
      </div>
      {editing && canOpenEditor ? (
        <div className="flex max-w-72 flex-col gap-1.5">
          <Input
            ref={inputRef}
            aria-label="Search or create output"
            aria-invalid={Boolean(validationMessage)}
            maxLength={outputIdMaxLength}
            value={query} placeholder="output id"
            className="h-7 font-mono text-sm"
            onChange={(event) => setQuery(event.target.value.toLowerCase())}
            onKeyDown={(event) => {
              if (event.key === "Escape") closeEditor();
              if (event.key === "Enter") {
                event.preventDefault();
                submitQuery();
              }
            }}
          />
          {validationMessage ? <FieldError>{validationMessage}</FieldError> : null}
          <div className="flex flex-col gap-1">
            {suggestions.map((suggestion) => (
              <Button key={suggestion} type="button" size="xs" variant="ghost" className="justify-start font-mono" onClick={() => selectOutput(suggestion)}>
                {suggestion}
              </Button>
            ))}
            {canCreate ? (
              <Button type="button" size="xs" variant="ghost" className="justify-start font-mono" onClick={createOutput}>
                Create {normalizedQuery}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
