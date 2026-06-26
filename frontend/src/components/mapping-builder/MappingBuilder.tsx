import { useId, useMemo } from "react";
import { ArrowLeft, Wand2 } from "lucide-react";
import type { DataShapeFieldDraft } from "backend/shared/flow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  autoMapRows,
  defaultMappingRows,
  mappingLabels,
  mappingPaths,
  previewContextFromFields,
  previewForRow,
  rowWarnings,
  type MappingBuilderLabels,
  type MappingBuilderPathOptions,
  type MappingRowDraft
} from "@/components/mapping-builder/mapping-builder-model";

export {
  mappingExpressionToRows,
  rowsToMappingExpression
} from "@/components/mapping-builder/mapping-builder-model";
export type {
  MappingBuilderLabels,
  MappingBuilderPathOptions,
  MappingRowDraft
} from "@/components/mapping-builder/mapping-builder-model";

export function MappingBuilder({
  sourceFields,
  targetFields,
  rows,
  onChange,
  labels,
  pathOptions,
  previewContext
}: {
  sourceFields: DataShapeFieldDraft[];
  targetFields: DataShapeFieldDraft[];
  rows: MappingRowDraft[];
  onChange: (rows: MappingRowDraft[]) => void;
  labels?: MappingBuilderLabels;
  pathOptions?: MappingBuilderPathOptions;
  previewContext?: unknown;
}) {
  const displayLabels = mappingLabels(labels);
  const paths = useMemo(() => mappingPaths(pathOptions), [pathOptions]);
  const effectivePreviewContext = useMemo(
    () => previewContext ?? previewContextFromFields(sourceFields, paths),
    [paths, previewContext, sourceFields]
  );
  const effectiveRows = defaultMappingRows(targetFields, rows);
  const update = (target: string, patch: Partial<MappingRowDraft>) => {
    onChange(effectiveRows.map((row) => row.target === target ? { ...row, ...patch } : row));
  };
  const autoMap = () => {
    onChange(autoMapRows(sourceFields, targetFields));
  };

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{displayLabels.title}</h3>
        <Button type="button" size="sm" variant="outline" onClick={autoMap}>
          <Wand2 className="size-4" />
          Auto-map
        </Button>
      </div>
      <div className="grid gap-2">
        {effectiveRows.map((row) => {
          const targetField = targetFields.find((field) => field.name === row.target);
          const warnings = targetField ? rowWarnings(row, targetField, sourceFields) : [];
          const preview = previewForRow(row, effectivePreviewContext, paths);
          return (
            <div key={row.target} className="grid gap-3 rounded-lg border border-white/10 bg-black/15 p-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-sm border border-emerald-300/25 bg-emerald-300/10 px-2 py-1 font-mono text-xs text-emerald-100">{row.target}</span>
                <ArrowLeft className="size-4 text-muted-foreground" />
                <span className="text-muted-foreground">{row.sourceKind.replace(/-/g, " ")}</span>
              </div>
              <div className="grid gap-3 md:grid-cols-[1fr_12rem_1fr_1fr] md:items-end">
                <div className="grid gap-1">
                  <Label>Target field</Label>
                  <div className="rounded-md border border-white/10 bg-black/20 px-3 py-2 font-mono text-sm text-emerald-100">{row.target}</div>
                </div>
                <div className="grid gap-1.5">
                  <Label>Value source</Label>
                  <Select value={row.sourceKind} onValueChange={(sourceKind) => update(row.target, { sourceKind: sourceKind as MappingRowDraft["sourceKind"] })}>
                    <SelectTrigger aria-label={`Value source for ${row.target}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="trigger-field">{displayLabels.sourceField}</SelectItem>
                        <SelectItem value="trigger-subject">{displayLabels.subject}</SelectItem>
                        <SelectItem value="trigger-project">{displayLabels.project}</SelectItem>
                        <SelectItem value="trigger-tag">{displayLabels.tag}</SelectItem>
                        <SelectItem value="constant">Constant value</SelectItem>
                        <SelectItem value="default">Default value</SelectItem>
                        <SelectItem value="template">Template</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                {row.sourceKind === "trigger-field" ? (
                  <div className="grid gap-1.5">
                    <Label>Source field</Label>
                    <Select value={row.sourceField || row.target} onValueChange={(sourceField) => update(row.target, { sourceField })}>
                      <SelectTrigger aria-label={`Source field for ${row.target}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {sourceFields.map((field) => <SelectItem key={field.name} value={field.name}>{field.label || field.name}</SelectItem>)}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                ) : row.sourceKind === "trigger-tag" ? (
                  <LabeledInput label="Tag position" value={row.sourceField ?? "0"} onChange={(sourceField) => update(row.target, { sourceField })} />
                ) : (
                  <LabeledInput
                    label={row.sourceKind === "constant" ? "Value" : row.sourceKind === "template" ? "Template" : "Default"}
                    value={row.sourceKind === "constant" || row.sourceKind === "template" ? row.value ?? "" : row.defaultValue ?? ""}
                    onChange={(value) => update(row.target, row.sourceKind === "constant" || row.sourceKind === "template" ? { value } : { defaultValue: value })}
                  />
                )}
                <LabeledInput label="Fallback" value={row.defaultValue ?? ""} onChange={(defaultValue) => update(row.target, { defaultValue })} />
              </div>
              {warnings.length ? (
                <div aria-live="polite" className="grid gap-1 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">
                  {warnings.map((warning) => <div key={warning}>{warning}</div>)}
                </div>
              ) : null}
              <div className="rounded-md border border-white/10 bg-black/20 p-2 text-sm">
                <span className="font-medium">Preview value</span>
                <span className="text-muted-foreground"> · {preview.ok ? preview.value : preview.error}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LabeledInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
