import { Button } from "@/components/ui/button";
import type { EventStormingModelV2 } from "@shared/orchestration/eventStorming";
import { stormProcessStoryIds } from "@shared/orchestration/eventStormingContext";
export function StormOverview({ model, search, storyId, select }: { model: EventStormingModelV2; search: string; storyId?: string; select(id: string): void }) {
  const needle = search.toLocaleLowerCase();
  const processes = model.processes.filter((p) => `${p.title} ${p.description} ${p.steps.map((s) => model.concepts.find((c) => c.id === s.conceptId)?.title).join(" ")}`.toLocaleLowerCase().includes(needle));
  return <div className="storm-overview">
    {!model.processes.length && <p>Start a process with a few events. Stories, commands and responsibility boundaries can be added later.</p>}
    {processes.map((p) => {
      const highlighted = storyId && stormProcessStoryIds(p).includes(storyId);
      const events = p.steps.map((s) => ({ stepId: s.id, concept: model.concepts.find((c) => c.id === s.conceptId)! })).filter(({ concept }) => concept.kind === "event");
      // These are previews; only explicit connections below claim an event ordering.
      const eventIds = new Set(p.steps.filter((s) => model.concepts.find((c) => c.id === s.conceptId)?.kind === "event").map((s) => s.id));
      const flow = p.connections.filter((c) => c.kind === "flow" && eventIds.has(c.source) && eventIds.has(c.target));
      const title = (id: string) => model.concepts.find((c) => c.id === p.steps.find((s) => s.id === id)?.conceptId)?.title;
      return <section key={p.id} className={`storm-process-card${highlighted ? " storm-highlight" : ""}`}>
        <Button variant="link" onClick={() => select(p.id)}><h2>{p.title || "Untitled process"}</h2></Button>
        <p>{p.steps.length} steps · {stormProcessStoryIds(p).length} stories{highlighted ? " · Linked to selected story" : ""}</p>
        <div className="storm-event-previews">{events.slice(0, 6).map(({ stepId, concept: c }) => <span key={stepId} className="storm-color-event">◆ {c.title || "Untitled event"}</span>)}</div>
        {flow.slice(0, 3).map((c) => <p className="storm-preview-flow" key={c.id}>{title(c.source)} → <span>{c.label || "Next"}</span> → {title(c.target)}</p>)}
        <Button variant="outline" onClick={() => select(p.id)}>Open process</Button>
      </section>;
    })}
    {model.sharedConceptIds.map((id) => { const c = model.concepts.find((c) => c.id === id)!; return <details key={id}><summary>? {c.title}</summary><p>{c.details}</p></details>; })}
    {model.documentation && <details><summary>Source workshop notes</summary><pre className="storm-source-prose">{model.documentation}</pre></details>}
  </div>;
}
