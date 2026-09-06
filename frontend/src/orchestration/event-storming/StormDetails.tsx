import { Button } from "@/components/ui/button";
import type { EventStormingModelV2, StormProcess } from "@shared/orchestration/eventStorming";
import type { StormView } from "@shared/orchestration/eventStormingLayout";
import type { UserStoryCollection } from "@shared/orchestration/userStories";
import type { StormEdit } from "./StormDocumentStore";
import type { StormActions } from "./useStormActions";
import { NOTE_KINDS } from "./stormPresentation";
import { removeStormSteps } from "./stormOperations";
import { StormStoryLinks } from "./StormStoryLinks";
interface Props { model: EventStormingModelV2; process: StormProcess; view: StormView; stepId?: string; actions: StormActions; edit(change: StormEdit): void; locked: boolean; stories?: UserStoryCollection; openStory(id: string): void }
export function StormDetails({ model, process, view, stepId, actions, edit, locked, stories, openStory }: Props) {
  const step = process.steps.find((s) => s.id === stepId), concept = model.concepts.find((c) => c.id === step?.conceptId);
  const edgeId = view.connections.find((c) => actions.selected.includes(c.id))?.connectionId;
  const edge = process.connections.find((c) => c.id === edgeId);
  const content = concept ?? { title: process.title, details: process.description, sources: process.sources };
  const ids = step?.storyIds ?? process.storyIds;
  const patchEdge = (patch: Partial<NonNullable<typeof edge>>) => edit((d) => Object.assign(d.model.processes.find((p) => p.id === process.id)!.connections.find((c) => c.id === edgeId)!, patch));
  return <div className="storm-details-content">
    <h2>{edge ? "Connection" : concept ? NOTE_KINDS[concept.kind].label : "Process details"}</h2>
    {edge ? <>
      <label>Connection name<input aria-label="Connection name" value={edge.label} readOnly={locked} onChange={(e) => patchEdge({ label: e.target.value })} /></label>
      <label>Connection type<select value={edge.kind} disabled={locked} onChange={(e) => patchEdge({ kind: e.target.value as typeof edge.kind })}><option value="flow">Event flow</option><option value="support">Supporting information</option><option value="responsibility">Responsibility</option></select></label>
      <label>Condition<textarea aria-label="Connection condition" value={edge.condition} readOnly={locked} onChange={(e) => patchEdge({ condition: e.target.value })} /></label>
    </> : <>
      <label>{concept ? "Card name" : "Process name"}<input aria-label={concept ? "Card name" : "Process name"} value={content.title} readOnly={locked}
        onChange={(e) => concept ? actions.patchNote(concept.id, { title: e.target.value }) : actions.patchProcess({ title: e.target.value })} /></label>
      <label>Description<textarea aria-label="Description" value={content.details} readOnly={locked}
        onChange={(e) => concept ? actions.patchNote(concept.id, { details: e.target.value }) : actions.patchProcess({ description: e.target.value })} /></label>
      {concept && <p className="storm-id">Concept {concept.id}<br />Step {step?.id}<br />Used in {model.processes.filter((p) => p.steps.some((s) => s.conceptId === concept.id)).length} processes. Concept edits update every occurrence.</p>}
      <label>Sources (one per line)<textarea aria-label="Sources" value={content.sources.join("\n")} readOnly={locked}
        onChange={(e) => { const sources = e.target.value.split("\n").filter(Boolean); if (concept) actions.patchNote(concept.id, { sources }); else actions.patchProcess({ sources }); }} /></label>
      {concept && <><h3>Reuse a concept</h3><label>Add another occurrence<select aria-label="Reuse a concept" value="" disabled={locked} onChange={(e) => { const c = model.concepts.find((c) => c.id === e.target.value); if (c) actions.addNote(c.kind, undefined, c.id); }}><option value="">Choose concept…</option>{model.concepts.map((c) => <option key={c.id} value={c.id}>{NOTE_KINDS[c.kind].label}: {c.title || "Untitled"}</option>)}</select></label></>}
      {step && process.storyIds.length > 0 && <StormStoryLinks inherited ids={process.storyIds} collection={stories} locked={locked} open={openStory} change={() => {}} />}
      <StormStoryLinks ids={ids} collection={stories} locked={locked} open={openStory} change={(storyIds) => edit((d) => {
        const p = d.model.processes.find((p) => p.id === process.id)!;
        if (step) p.steps.find((s) => s.id === step.id)!.storyIds = storyIds; else p.storyIds = storyIds;
      })} />
      {!step && <>
        {process.boundaries.map((b) => <details key={b.id}><summary>Responsibility: {b.title}</summary><p>{b.details}</p><p>{b.stepIds.length} explicitly linked steps</p></details>)}
        <Button variant="destructive" disabled={locked} onClick={() => {
          if (!window.confirm(`Delete process “${process.title}” and its steps? Shared concepts and stories remain.`)) return;
          edit((d) => { removeStormSteps(d, process.id, process.steps.map((s) => s.id));
            d.model.processes = d.model.processes.filter((p) => p.id !== process.id);
            d.layout.views = d.layout.views.filter((v) => v.processId !== process.id);
          });
        }}>Delete process</Button>
      </>}
    </>}
  </div>;
}
