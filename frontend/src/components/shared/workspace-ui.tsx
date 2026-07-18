export { DeleteConfirmDialog } from "./DeleteConfirmDialog";
export { CollectionAddCard, CollectionCardGrid, CollectionEntityCard } from "./collection-overview";
export { DeleteAction, EditorActions } from "./editor-actions";
export { EmptyState } from "./empty-state";
export { SelectField, TextAreaField, TextField } from "./form-field";
export type { FormFieldDensity, FormFieldLayout } from "./form-field";
export { OperationalStatus, StatusDot } from "./operational-status";
export type { OperationalStatusTone } from "./operational-status";
export { WorkbenchLayout } from "./workbench-layout";
export { WorkspacePanel, Panel } from "./workspace-panel";

export function ErrorPreview({ errors }: { errors?: string[] }) {
  return errors?.length
    ? <span className="text-destructive">{errors.join("; ")}</span>
    : <span className="text-muted-foreground">None</span>;
}
