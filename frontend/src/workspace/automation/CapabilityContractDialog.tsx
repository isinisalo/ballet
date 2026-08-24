import { useEffect, useState, type ReactNode } from "react";
import type { ProjectGraphNode, ProjectIntrinsicOutcome, ProjectActionNode } from "@shared/api/workspace-contracts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

type CapabilityNode = ProjectGraphNode | ProjectActionNode;

export function CapabilityContractDialog({ node, open, locked, onOpenChange, onSave }: {
  node?: CapabilityNode; open: boolean; locked: boolean; onOpenChange: (open: boolean) => void;
  onSave: (patch: {
    description: string;
    capabilities: CapabilityNode["capabilities"];
    outcomes: ProjectIntrinsicOutcome[];
    stateDescription?: string;
  }) => void;
}) {
  const [description, setDescription] = useState("");
  const [accepts, setAccepts] = useState("");
  const [provides, setProvides] = useState("");
  const [outcomes, setOutcomes] = useState("");
  const [stateDescription, setStateDescription] = useState("");
  useEffect(() => {
    if (!open || !node) return;
    setDescription(node.description); setAccepts(node.capabilities.accepts.join("\n"));
    setProvides(node.capabilities.provides.join("\n"));
    setOutcomes(node.outcomes.map(({ outcomeId, result }) => `${outcomeId}:${result}`).join("\n"));
    setStateDescription("stateContract" in node ? node.stateContract.description : "");
  }, [node, open]);
  const parsedOutcomes = parseOutcomes(outcomes);
  const issue = !description.trim() ? "Description is required." : parsedOutcomes.issue;
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90svh] overflow-auto sm:max-w-2xl">
    <DialogHeader><DialogTitle>Capability contract</DialogTitle><DialogDescription>Intrinsic outcomes declare semantics only. Probabilities, costs and project state transitions belong to the scoped Decision Model.</DialogDescription></DialogHeader>
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Description" className="sm:col-span-2"><Textarea value={description} disabled={locked} onChange={(event) => setDescription(event.target.value)} /></Field>
      <Field label="Accepts — one capability per line"><Textarea value={accepts} disabled={locked} className="min-h-28 font-mono text-xs" onChange={(event) => setAccepts(event.target.value)} /></Field>
      <Field label="Provides — one capability per line"><Textarea value={provides} disabled={locked} className="min-h-28 font-mono text-xs" onChange={(event) => setProvides(event.target.value)} /></Field>
      <Field label="Intrinsic outcomes — outcome-id:PASS|FAIL" className="sm:col-span-2"><Textarea value={outcomes} disabled={locked} className="min-h-32 font-mono text-xs" placeholder={"success:PASS\nimplementation-defect:FAIL"} onChange={(event) => setOutcomes(event.target.value)} /></Field>
      {node && "stateContract" in node ? <Field label="State contract" className="sm:col-span-2"><Textarea value={stateDescription} disabled={locked} onChange={(event) => setStateDescription(event.target.value)} /></Field> : null}
      {issue ? <Alert variant="destructive" className="sm:col-span-2"><AlertDescription>{issue}</AlertDescription></Alert> : null}
    </div>
    <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={locked || Boolean(issue)} onClick={() => {
      onSave({ description: description.trim(), capabilities: { accepts: lines(accepts), provides: lines(provides) }, outcomes: parsedOutcomes.values, stateDescription: stateDescription.trim() || undefined });
      onOpenChange(false);
    }}>Apply to draft</Button></DialogFooter>
  </DialogContent></Dialog>;
}

const lines = (value: string) => [...new Set(value.split(/\n|,/).map((entry) => entry.trim()).filter(Boolean))];
const parseOutcomes = (value: string): { values: ProjectIntrinsicOutcome[]; issue: string } => {
  const entries = lines(value); const parsed: ProjectIntrinsicOutcome[] = [];
  for (const entry of entries) {
    const [outcomeId, result, ...rest] = entry.split(":");
    if (!outcomeId || rest.length || (result !== "PASS" && result !== "FAIL")) return { values: [], issue: `Invalid outcome "${entry}". Use outcome-id:PASS or outcome-id:FAIL.` };
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(outcomeId)) return { values: [], issue: `Outcome ID "${outcomeId}" must be lowercase kebab-case.` };
    parsed.push({ outcomeId, result });
  }
  if (new Set(parsed.map(({ outcomeId }) => outcomeId)).size !== parsed.length) return { values: [], issue: "Outcome IDs must be unique." };
  return { values: parsed, issue: "" };
};
const Field = ({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) => <label className={`grid gap-1.5 text-xs ${className}`}><span className="font-mono text-[0.65rem] uppercase tracking-wide text-muted-foreground">{label}</span>{children}</label>;
