import type { DataShapeFieldDraft } from "backend/shared/flow";
import type { MappingExpression } from "backend/shared/mapping";

export interface MappingRowDraft {
  target: string;
  sourceKind: "trigger-field" | "trigger-subject" | "trigger-project" | "trigger-tag" | "constant" | "default" | "template";
  sourceField?: string;
  value?: string;
  defaultValue?: string;
}

export interface MappingBuilderPathOptions {
  dataRoot?: string;
  subjectPath?: string;
  projectPath?: string;
  tagPathPrefix?: string;
}

export interface MappingBuilderLabels {
  title?: string;
  sourceField?: string;
  subject?: string;
  project?: string;
  tag?: string;
}

const defaultPathOptions: Required<MappingBuilderPathOptions> = {
  dataRoot: "/event/data",
  subjectPath: "/event/subject",
  projectPath: "/event/projectId",
  tagPathPrefix: "/event/tags"
};

const defaultLabels: Required<MappingBuilderLabels> = {
  title: "Input mapping",
  sourceField: "Trigger data field",
  subject: "Trigger subject",
  project: "Trigger project",
  tag: "Trigger tag"
};

export const mappingPaths = (options?: MappingBuilderPathOptions): Required<MappingBuilderPathOptions> => ({
  ...defaultPathOptions,
  ...options
});

export const mappingLabels = (labels?: MappingBuilderLabels): Required<MappingBuilderLabels> => ({
  ...defaultLabels,
  ...labels
});

const pointerSegment = (value: string): string => value.replace(/~/g, "~0").replace(/\//g, "~1");
const unpointerSegment = (value: string): string => value.replace(/~1/g, "/").replace(/~0/g, "~");
const nonEmptyDefault = (value: string | undefined) => value === undefined || value === "" ? {} : { default: value };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const fieldTypeLabels: Record<DataShapeFieldDraft["type"], string> = {
  text: "text",
  number: "number",
  boolean: "true or false",
  "text-list": "text list",
  "number-list": "number list",
  object: "object",
  "object-list": "object list"
};

const sampleValueForField = (field: DataShapeFieldDraft): unknown => {
  if (field.example !== undefined) return field.example;
  if (field.default !== undefined) return field.default;
  if (field.allowedValues?.length) return field.allowedValues[0];
  if (field.type === "number") return 1;
  if (field.type === "boolean") return true;
  if (field.type === "text-list") return ["Example"];
  if (field.type === "number-list") return [1];
  if (field.type === "object") return {};
  if (field.type === "object-list") return [{}];
  return field.label || field.name || "Example";
};

const setByPointer = (target: Record<string, unknown>, path: string, value: unknown) => {
  if (!path || !path.startsWith("/")) return;
  const segments = path.slice(1).split("/").map(unpointerSegment);
  let cursor: Record<string, unknown> = target;
  for (const [index, segment] of segments.entries()) {
    const isLast = index === segments.length - 1;
    if (isLast) {
      cursor[segment] = value;
      return;
    }
    if (!isRecord(cursor[segment])) cursor[segment] = {};
    cursor = cursor[segment] as Record<string, unknown>;
  }
};

const lookupByPointer = (source: unknown, path: string): { found: true; value: unknown } | { found: false } => {
  if (path === "") return { found: true, value: source };
  if (!path.startsWith("/")) return { found: false };
  let current = source;
  for (const segment of path.slice(1).split("/").map(unpointerSegment)) {
    if (Array.isArray(current)) {
      if (!/^(0|[1-9]\d*)$/.test(segment)) return { found: false };
      const index = Number(segment);
      if (index >= current.length) return { found: false };
      current = current[index];
      continue;
    }
    if (!isRecord(current) || !Object.prototype.hasOwnProperty.call(current, segment)) return { found: false };
    current = current[segment];
  }
  return { found: true, value: current };
};

export const previewContextFromFields = (
  sourceFields: DataShapeFieldDraft[],
  paths: Required<MappingBuilderPathOptions>
): Record<string, unknown> => {
  const context: Record<string, unknown> = {};
  setByPointer(context, paths.dataRoot, Object.fromEntries(sourceFields.filter((field) => field.name).map((field) => [field.name, sampleValueForField(field)])));
  setByPointer(context, paths.subjectPath, "Example subject");
  setByPointer(context, paths.projectPath, "Example project");
  setByPointer(context, paths.tagPathPrefix, ["example"]);
  return context;
};

const titleFromKey = (value: string): string =>
  value.replace(/[-_.]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\b\w/g, (letter) => letter.toUpperCase());

const fieldLabel = (field: DataShapeFieldDraft | undefined, fallback: string): string =>
  field?.label || field?.name || titleFromKey(fallback);

const sourceFieldForRow = (row: MappingRowDraft, sourceFields: DataShapeFieldDraft[]): DataShapeFieldDraft | undefined => {
  if (row.sourceKind !== "trigger-field" && row.sourceKind !== "default") return undefined;
  return sourceFields.find((field) => field.name === (row.sourceField || row.target));
};

const mappedTypeForRow = (
  row: MappingRowDraft,
  sourceField: DataShapeFieldDraft | undefined
): DataShapeFieldDraft["type"] | undefined => {
  if (row.sourceKind === "trigger-field" || row.sourceKind === "default") return sourceField?.type;
  return "text";
};

const typesCompatible = (
  sourceType: DataShapeFieldDraft["type"] | undefined,
  targetType: DataShapeFieldDraft["type"]
): boolean => !sourceType || sourceType === targetType;

export const rowWarnings = (
  row: MappingRowDraft,
  targetField: DataShapeFieldDraft,
  sourceFields: DataShapeFieldDraft[]
): string[] => {
  const sourceField = sourceFieldForRow(row, sourceFields);
  const sourceType = mappedTypeForRow(row, sourceField);
  const sourceLabel = row.sourceKind === "trigger-field" || row.sourceKind === "default"
    ? fieldLabel(sourceField, row.sourceField || row.target)
    : mappingSourceLabel(row.sourceKind);
  const targetLabel = fieldLabel(targetField, row.target);
  const warnings: string[] = [];

  if (targetField.required && (row.sourceKind === "trigger-field" || row.sourceKind === "default") && !sourceField && !row.defaultValue) {
    warnings.push(`Required field ${targetLabel} has no available source or fallback.`);
  }
  if (sourceType && !typesCompatible(sourceType, targetField.type)) {
    warnings.push(`${sourceLabel} is ${fieldTypeLabels[sourceType]}, but ${targetLabel} expects ${fieldTypeLabels[targetField.type]}.`);
  }
  if (row.defaultValue && targetField.type !== "text") {
    warnings.push(`Fallback values are saved as text, but ${targetLabel} expects ${fieldTypeLabels[targetField.type]}.`);
  }

  return warnings;
};

const mappingSourceLabel = (sourceKind: MappingRowDraft["sourceKind"]): string => {
  if (sourceKind === "trigger-subject") return "Trigger subject";
  if (sourceKind === "trigger-project") return "Trigger project";
  if (sourceKind === "trigger-tag") return "Trigger tag";
  if (sourceKind === "constant") return "Constant value";
  if (sourceKind === "default") return "Default value";
  if (sourceKind === "template") return "Template";
  return "Trigger data field";
};

const valueLabel = (value: unknown): string => {
  if (value === "") return "Empty text";
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
};

export const previewForRow = (
  row: MappingRowDraft,
  context: unknown,
  paths: Required<MappingBuilderPathOptions>
): { ok: true; value: string } | { ok: false; error: string } => {
  try {
    if (row.sourceKind === "constant") return { ok: true, value: valueLabel(row.value ?? "") };
    if (row.sourceKind === "template") {
      return {
        ok: true,
        value: valueLabel((row.value ?? "").replace(/\{\{([^}]+)\}\}/g, (_match, rawPath: string) => {
          const lookup = lookupByPointer(context, rawPath.trim());
          if (!lookup.found) throw new Error(`Template placeholder source is missing at ${rawPath.trim()}.`);
          return valueLabel(lookup.value);
        }))
      };
    }
    const sourcePath = row.sourceKind === "trigger-subject"
      ? paths.subjectPath
      : row.sourceKind === "trigger-project"
        ? paths.projectPath
        : row.sourceKind === "trigger-tag"
          ? `${paths.tagPathPrefix}/${pointerSegment(row.sourceField || "0")}`
          : `${paths.dataRoot}/${pointerSegment(row.sourceField || row.target)}`;
    const lookup = lookupByPointer(context, sourcePath);
    if (lookup.found) return { ok: true, value: valueLabel(lookup.value) };
    if (row.defaultValue !== undefined || row.sourceKind === "default") return { ok: true, value: valueLabel(row.defaultValue ?? "") };
    return { ok: false, error: `Required mapping source is missing at ${sourcePath}.` };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unable to preview this mapping." };
  }
};

export const defaultMappingRows = (targetFields: DataShapeFieldDraft[], rows: MappingRowDraft[]): MappingRowDraft[] =>
  targetFields.map((field) => rows.find((row) => row.target === field.name) ?? {
    target: field.name,
    sourceKind: "trigger-field" as const,
    sourceField: field.name
  });

export const autoMapRows = (sourceFields: DataShapeFieldDraft[], targetFields: DataShapeFieldDraft[]): MappingRowDraft[] =>
  targetFields.map((target) => {
    const exact = sourceFields.find((source) => source.name === target.name);
    const normalized = sourceFields.find((source) => source.name.toLowerCase().replace(/[^a-z0-9]/g, "") === target.name.toLowerCase().replace(/[^a-z0-9]/g, ""));
    return {
      target: target.name,
      sourceKind: target.name.toLowerCase().includes("subject") ? "trigger-subject" : "trigger-field",
      sourceField: (exact ?? normalized)?.name ?? target.name,
      defaultValue: target.required ? undefined : ""
    };
  });

export const rowsToMappingExpression = (rows: MappingRowDraft[], options?: MappingBuilderPathOptions): MappingExpression => {
  const paths = mappingPaths(options);
  return {
    object: Object.fromEntries(rows.filter((row) => row.target).map((row) => {
      if (row.sourceKind === "trigger-subject") return [row.target, { from: paths.subjectPath, ...nonEmptyDefault(row.defaultValue) }];
      if (row.sourceKind === "trigger-project") return [row.target, { from: paths.projectPath, ...nonEmptyDefault(row.defaultValue) }];
      if (row.sourceKind === "trigger-tag") return [row.target, { from: `${paths.tagPathPrefix}/${pointerSegment(row.sourceField || "0")}`, ...nonEmptyDefault(row.defaultValue) }];
      if (row.sourceKind === "constant") return [row.target, { const: row.value ?? "" }];
      if (row.sourceKind === "default") return [row.target, { coalesce: [{ from: `${paths.dataRoot}/${pointerSegment(row.sourceField || row.target)}` }, { const: row.defaultValue ?? "" }] }];
      if (row.sourceKind === "template") return [row.target, { template: row.value ?? "" }];
      return [row.target, { from: `${paths.dataRoot}/${pointerSegment(row.sourceField || row.target)}`, ...nonEmptyDefault(row.defaultValue) }];
    }))
  };
};

export const mappingExpressionToRows = (mapping: MappingExpression | undefined, options?: MappingBuilderPathOptions): MappingRowDraft[] => {
  const paths = mappingPaths(options);
  if (!mapping || !("object" in mapping)) return [];
  return Object.entries(mapping.object).map(([target, expression]) => {
    if ("from" in expression && expression.from === paths.subjectPath) return { target, sourceKind: "trigger-subject", defaultValue: expression.default === undefined ? undefined : String(expression.default) };
    if ("from" in expression && expression.from === paths.projectPath) return { target, sourceKind: "trigger-project", defaultValue: expression.default === undefined ? undefined : String(expression.default) };
    if ("from" in expression && expression.from.startsWith(`${paths.tagPathPrefix}/`)) return { target, sourceKind: "trigger-tag", sourceField: unpointerSegment(expression.from.slice(paths.tagPathPrefix.length + 1)), defaultValue: expression.default === undefined ? undefined : String(expression.default) };
    if ("from" in expression) return { target, sourceKind: "trigger-field", sourceField: unpointerSegment(expression.from.startsWith(`${paths.dataRoot}/`) ? expression.from.slice(paths.dataRoot.length + 1) : expression.from), defaultValue: expression.default === undefined ? undefined : String(expression.default) };
    if ("const" in expression) return { target, sourceKind: "constant", value: String(expression.const ?? "") };
    if ("template" in expression) return { target, sourceKind: "template", value: expression.template };
    if ("coalesce" in expression && expression.coalesce.length === 2) {
      const [source, fallback] = expression.coalesce;
      if (isRecord(source) && "from" in source && typeof source.from === "string" && source.from.startsWith(`${paths.dataRoot}/`) && isRecord(fallback) && "const" in fallback) {
        const sourceField = unpointerSegment(source.from.slice(paths.dataRoot.length + 1));
        return {
          target,
          sourceKind: "default",
          sourceField: sourceField === target ? undefined : sourceField,
          defaultValue: String(fallback.const ?? "")
        };
      }
    }
    return { target, sourceKind: "trigger-field", sourceField: target };
  });
};
