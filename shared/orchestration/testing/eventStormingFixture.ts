import { emptyEventStormingModel } from "../eventStorming.js";
import { emptyEventStormingLayout } from "../eventStormingLayout.js";
export const stormId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export function stormFixture() {
  const model = emptyEventStormingModel(), layout = emptyEventStormingLayout();
  model.documentation = "# Workshop\n\nOriginal evidence.\n";
  model.concepts.push({ id: stormId(1), kind: "event", title: "Order received", details: "", sources: [] }, { id: stormId(2), kind: "command", title: "Process order", details: "", sources: [] });
  model.processes.push({ id: stormId(3), title: "Orders", description: "", storyIds: [], sources: [], boundaries: [],
    steps: [{ id: stormId(4), conceptId: stormId(1), storyIds: [], sources: [] }, { id: stormId(5), conceptId: stormId(2), storyIds: [], sources: [] }],
    connections: [{ id: stormId(6), source: stormId(4), target: stormId(5), kind: "flow", label: "Next", condition: "" }, { id: stormId(7), source: stormId(5), target: stormId(4), kind: "flow", label: "Retry", condition: "Retry budget remains" }] });
  layout.views.push({ id: stormId(3), processId: stormId(3), title: "Orders", description: "", kind: "process", frames: [],
    placements: model.processes[0].steps.map((s, i) => ({ id: s.id, stepId: s.id, x: 100 + i * 240, y: 100, width: 184, height: 168, pivotal: false })),
    connections: model.processes[0].connections.map((c) => ({ id: c.id, connectionId: c.id, source: c.source, target: c.target })) });
  return { model, layout };
}
