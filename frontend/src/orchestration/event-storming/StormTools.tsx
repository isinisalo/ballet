import { Button } from "@/components/ui/button";
import { ADVANCED_KINDS, BASIC_KINDS, NOTE_KINDS } from "./stormPresentation";
import type { StormActions } from "./useStormActions";
export function StormTools({ actions, locked }: { actions: StormActions; locked: boolean }) {
  return <div className="storm-tools" aria-label="Process map tools">
    <Button variant="outline" aria-pressed={actions.tool === "select"} onClick={() => actions.setTool("select")}>Select</Button>
    <Button variant="outline" aria-pressed={actions.tool === "hand"} onClick={() => actions.setTool("hand")}>Pan</Button>
    {BASIC_KINDS.map((kind) => <Button variant="outline" key={kind} disabled={locked} onClick={() => actions.addNote(kind)}><span aria-hidden="true">{NOTE_KINDS[kind].icon}</span>{NOTE_KINDS[kind].label}</Button>)}
    <details><summary>More types</summary><div>{ADVANCED_KINDS.map((kind) => <Button variant="ghost" key={kind} disabled={locked} onClick={() => actions.addNote(kind)}>{NOTE_KINDS[kind].label}</Button>)}</div></details>
    <Button variant="outline" disabled={locked || !actions.selected.length} onClick={actions.duplicate}>Repeat step</Button>
    <Button variant="outline" disabled={locked || !actions.selected.length} onClick={actions.remove}>Remove selection</Button>
  </div>;
}
