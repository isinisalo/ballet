import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { EventStormingModelV2, StormConnection, StormProcess } from "@shared/orchestration/eventStorming";
import type { StormEdit } from "./StormDocumentStore";
export function StormConnectDialog({ model, process, edit, locked }: { model: EventStormingModelV2; process: StormProcess; edit(fn: StormEdit, immediate?: boolean): void; locked: boolean }) {
  const [open, setOpen] = useState(false), [source, setSource] = useState(""), [target, setTarget] = useState("");
  const [label, setLabel] = useState("Next"), [condition, setCondition] = useState(""), [kind, setKind] = useState<StormConnection["kind"]>("flow");
  const options = process.steps.map((s) => <option key={s.id} value={s.id}>{model.concepts.find((c) => c.id === s.conceptId)?.title || "Untitled"} · {s.id.slice(-4)}</option>);
  return <><Button variant="outline" disabled={locked || process.steps.length < 2} onClick={() => setOpen(true)}>Add connection</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="storm-connect-dialog"><DialogHeader><DialogTitle>Add connection</DialogTitle><DialogDescription>Name the relationship and any branch condition.</DialogDescription></DialogHeader>
      <form className="storm-details-content" onSubmit={(e) => { e.preventDefault();
        if (locked || !source || !target) return;
        edit((d) => d.model.processes.find((p) => p.id === process.id)!.connections.push({ id: crypto.randomUUID(), source, target, label, condition, kind }), true); setOpen(false);
      }}>
        <label>From step<select aria-label="From step" value={source} onChange={(e) => setSource(e.target.value)} required><option value="">Choose…</option>{options}</select></label>
        <label>To step<select aria-label="To step" value={target} onChange={(e) => setTarget(e.target.value)} required><option value="">Choose…</option>{options}</select></label>
        <label>Relationship<select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}><option value="flow">Event flow</option><option value="support">Supporting information</option><option value="responsibility">Responsibility</option></select></label>
        <label>Name<input aria-label="New connection name" value={label} maxLength={500} onChange={(e) => setLabel(e.target.value)} /></label>
        <label>Condition<textarea aria-label="New connection condition" value={condition} onChange={(e) => setCondition(e.target.value)} /></label>
        <Button type="submit" disabled={locked || !source || !target}>Save connection</Button>
      </form>
    </DialogContent></Dialog>
  </>;
}
