import { MousePointer2, Hand, ArrowUpRight, Group, Search, AlignHorizontalJustifyStart, Copy, Trash2 } from "lucide-react";
import type { StormBoard, StormNoteKind } from "@shared/orchestration/eventStorming";
import { Button } from "@/components/ui/button";
import { NOTE_KINDS, palette } from "./stormPresentation";
import type { StormActions } from "./useStormActions";

export function StormTools({ board, actions, locked, search, link }: { board: StormBoard; actions: StormActions; locked: boolean; search(): void; link(): void }) {
  const hasSelection = actions.selected.length > 0;
  return <>
    <div className="storm-tools" role="toolbar" aria-label="Board tools">
      <Button variant="ghost" size="icon" title="Select" aria-label="Select" aria-pressed={actions.tool === "select"} onClick={() => actions.setTool("select")}><MousePointer2 /></Button>
      <Button variant="ghost" size="icon" title="Pan" aria-label="Pan" aria-pressed={actions.tool === "hand"} onClick={() => actions.setTool("hand")}><Hand /></Button>
      <span className="storm-tool-separator" />
      {palette(board.level).map((kind) => <Button key={kind} variant="ghost" className={`storm-note-tool storm-color-${kind}`} size="icon" title={`Add ${NOTE_KINDS[kind].label}`} aria-label={`Add ${NOTE_KINDS[kind].label}`} disabled={locked}
        onClick={() => actions.addNote(kind as StormNoteKind)}><span aria-hidden="true">{NOTE_KINDS[kind].icon}</span></Button>)}
      <span className="storm-tool-separator" />
      <Button variant="ghost" size="icon" title="Connect notes" aria-label="Connect notes" disabled={locked || board.placements.length < 2} onClick={link}><ArrowUpRight /></Button>
      <Button variant="ghost" size="icon" title="Frame selection" aria-label="Frame selection" disabled={locked || !hasSelection} onClick={() => actions.action("group")}><Group /></Button>
      <Button variant="ghost" size="icon" title="Search and add existing" aria-label="Search and add existing" onClick={search}><Search /></Button>
    </div>
    {hasSelection && <div className="storm-selection" role="toolbar" aria-label="Selection tools">
      <span>{actions.selected.length} selected</span>
      <Button variant="ghost" title="Align tops" aria-label="Align tops" size="icon" disabled={locked} onClick={() => actions.action("align")}><AlignHorizontalJustifyStart /></Button>
      <Button variant="ghost" title="Duplicate selection" aria-label="Duplicate selection" size="icon" disabled={locked} onClick={() => actions.action("duplicate")}><Copy /></Button>
      <Button variant="ghost" disabled={locked} onClick={() => actions.action("group")}>Frame</Button>
      <Button variant="ghost" disabled={locked} onClick={() => actions.action("grow")}>Larger</Button>
      <Button variant="ghost" disabled={locked} onClick={() => actions.action("shrink")}>Smaller</Button>
      <Button variant="ghost" disabled={locked} onClick={() => actions.action("pivotal")}>★ Pivotal</Button>
      {board.level !== "software-design" && <Button variant="outline" disabled={locked} onClick={() => actions.action("derive")}>{board.level === "big-picture" ? "Explore process" : "Design software"}<ArrowUpRight /></Button>}
      <Button variant="ghost" disabled={locked} onClick={() => actions.action("remove")}>Remove</Button>
      <Button variant="ghost" disabled={locked} onClick={() => actions.action("delete-everywhere")}><Trash2 />Delete everywhere</Button>
    </div>}
  </>;
}
