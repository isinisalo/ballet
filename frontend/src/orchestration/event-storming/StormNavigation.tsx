import { Button } from "@/components/ui/button";
import type { EventStormingModelV2, StormProcess } from "@shared/orchestration/eventStorming";
import type { EventStormingLayoutV1, StormView } from "@shared/orchestration/eventStormingLayout";
import type { UserStoryCollection } from "@shared/orchestration/userStories";
import type { RouteState } from "@/workspace/types";
import type { WorkspaceNavigation } from "@/workspace/useWorkspaceNavigation";
import { stormPath } from "./stormPresentation";
interface Props { model: EventStormingModelV2; process?: StormProcess; view?: StormView; route: RouteState; stories?: UserStoryCollection; layout: EventStormingLayoutV1; search: string; setSearch(value: string): void; navigate: WorkspaceNavigation["navigate"]; showDetails(): void }
export function StormNavigation({ model, process, view, route, stories, layout, search, setSearch, navigate, showDetails }: Props) {
  return (
    <div className="storm-navigation"><label>Process<select aria-label="Select process" value={process?.id ?? ""} onChange={(e) => navigate(stormPath(e.target.value || undefined, undefined, undefined, route.storyId))}><option value="">Overview</option>{model.processes.map((p) => <option key={p.id} value={p.id}>{p.title || "Untitled process"}</option>)}</select></label>
      <label>Search<input aria-label="Search process map" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
      <label>Highlight story<select aria-label="Highlight story" value={route.storyId ?? ""} onChange={(e) => navigate(stormPath(process?.id, route.itemId, view?.id, e.target.value || undefined))}><option value="">All stories</option>{stories?.stories.map(({ value: s }) => <option key={s.id} value={s.id}>{s.goal} ({s.status})</option>)}</select></label>
      {process && view && <><label>Presentation<select aria-label="Presentation" value={view.id} onChange={(e) => navigate(stormPath(process.id, undefined, e.target.value, route.storyId))}>
        <option value={process.id}>Process map</option>{layout.views.filter((v) => v.processId === process.id && v.id !== process.id).map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}</select></label>
        <Button variant="outline" onClick={() => { showDetails(); navigate(stormPath(process.id, undefined, view.id, route.storyId)); }}>Process details</Button></>}
    </div>
  );
}
