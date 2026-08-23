import { useEffect, useState, type ReactNode } from "react";
import type { ExecutionProfile, ProjectInstruction } from "@shared/api/workspace-contracts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type CreateInput = { id: string; description: string; executionProfileId: string; primaryInstructionId: string };

export const GraphNodeCreateDialog = (props: SharedCreateProps) => <NodeCreateDialog {...props} entity="Graph Node" />;
export const ActionNodeCreateDialog = (props: SharedCreateProps) => <NodeCreateDialog {...props} entity="Action Node" />;

interface SharedCreateProps {
  open: boolean; onOpenChange: (open: boolean) => void; profiles: ExecutionProfile[];
  instructions: ProjectInstruction[]; existingIds: string[]; onCreate: (input: CreateInput) => void;
}

function NodeCreateDialog({ open, onOpenChange, profiles, instructions, existingIds, onCreate, entity }: SharedCreateProps & { entity: string }) {
  const [id, setId] = useState("");
  const [description, setDescription] = useState("");
  const [profile, setProfile] = useState("");
  const [instruction, setInstruction] = useState("");
  useEffect(() => { if (!open) { setId(""); setDescription(""); setProfile(""); setInstruction(""); } }, [open]);
  const issue = !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) ? `${entity} ID must be lowercase kebab-case.`
    : existingIds.includes(id) ? `${entity} ${id} already exists.` : !description.trim() ? "Description is required."
      : !profile ? "Choose an execution profile." : !instruction ? "Choose an instruction." : "";
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-lg">
    <DialogHeader><DialogTitle>Add {entity}</DialogTitle><DialogDescription>Create a capability action. Probability and cost priors are never generated automatically.</DialogDescription></DialogHeader>
    <div className="grid gap-3">
      <Field label={`${entity} ID`}><Input autoFocus value={id} onChange={(event) => setId(event.target.value)} placeholder={entity === "Graph Node" ? "threat-model" : "inspect-boundaries"} /></Field>
      <Field label="Description"><Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe what this capability can do." /></Field>
      <Field label="Execution profile"><Select value={profile} values={profiles.map(({ id: value }) => value)} onChange={setProfile} placeholder="Choose profile" /></Field>
      <Field label="Instruction"><Select value={instruction} values={instructions.flatMap(({ id: value, valid }) => value && valid ? [value] : [])} onChange={setInstruction} placeholder="Choose instruction" /></Field>
      {issue && id ? <Alert variant="destructive"><AlertDescription>{issue}</AlertDescription></Alert> : null}
    </div>
    <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={Boolean(issue)} onClick={() => {
      onCreate({ id, description: description.trim(), executionProfileId: profile, primaryInstructionId: instruction });
      onOpenChange(false);
    }}>Add capability</Button></DialogFooter>
  </DialogContent></Dialog>;
}

export const GraphNodeRenameDialog = (props: SharedRenameProps) => <NodeRenameDialog {...props} entity="Graph Node" />;
export const ActionNodeRenameDialog = (props: SharedRenameProps) => <NodeRenameDialog {...props} entity="Action Node" />;

interface SharedRenameProps {
  open: boolean; onOpenChange: (open: boolean) => void; currentId: string;
  existingIds: string[]; onRename: (id: string) => void;
}

function NodeRenameDialog({ open, onOpenChange, currentId, existingIds, onRename, entity }: SharedRenameProps & { entity: string }) {
  const [id, setId] = useState(currentId);
  useEffect(() => { if (open) setId(currentId); }, [currentId, open]);
  const issue = !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) ? `${entity} ID must be lowercase kebab-case.`
    : id !== currentId && existingIds.includes(id) ? `${entity} ${id} already exists.` : "";
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent>
    <DialogHeader><DialogTitle>Rename {entity}</DialogTitle><DialogDescription>All scoped policy references are updated atomically in this draft.</DialogDescription></DialogHeader>
    <Field label={`${entity} ID`}><Input autoFocus value={id} onChange={(event) => setId(event.target.value)} /></Field>
    {issue ? <Alert variant="destructive"><AlertDescription>{issue}</AlertDescription></Alert> : null}
    <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={Boolean(issue) || id === currentId} onClick={() => { onRename(id); onOpenChange(false); }}>Rename</Button></DialogFooter>
  </DialogContent></Dialog>;
}

const Field = ({ label, children }: { label: string; children: ReactNode }) => <label className="grid gap-1.5 text-xs"><span className="font-mono text-[0.65rem] uppercase tracking-wide text-muted-foreground">{label}</span>{children}</label>;
const Select = ({ value, values, placeholder, onChange }: { value: string; values: string[]; placeholder: string; onChange: (value: string) => void }) => <select value={value} className="h-8 rounded border border-input bg-background px-2 text-xs" onChange={(event) => onChange(event.target.value)}><option value="">{placeholder}</option>{values.map((entry) => <option key={entry}>{entry}</option>)}</select>;
