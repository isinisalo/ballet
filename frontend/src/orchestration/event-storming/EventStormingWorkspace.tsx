import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StormHeader } from "./StormHeader";
import type { StormLevel } from "@shared/orchestration/eventStorming";
import type { RouteState } from "@/workspace/types";
import type { WorkspaceNavigation } from "@/workspace/useWorkspaceNavigation";
import { useStormDocument } from "./useStormDocument";
import { useStormActions } from "./useStormActions";
import { LEVELS, stormPath } from "./stormPresentation";
import { StormCanvas } from "./StormCanvas";
import { StormTools } from "./StormTools";
import { StormConnectDialog, StormDeleteDialog, StormLibrary } from "./StormDialogs";
import { StormFileFeedback } from "./StormFileFeedback";
import "./eventStorming.css";

export function EventStormingWorkspace({ route, locked, navigate, onDirty }: { route: RouteState; locked: boolean; navigate: WorkspaceNavigation["navigate"]; onDirty(value: boolean): void }) {
  const document = useStormDocument(locked, onDirty);
  const board = document.value.boards.find((b) => b.id === route.entityId);
  const actions = useStormActions(board, document.store.edit, navigate);
  const [level, setLevel] = useState<StormLevel>("big-picture");
  const [library, setLibrary] = useState(false); const [connect, setConnect] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const readOnly = locked || document.conflict || !document.baseline;
  const invalid = Boolean(route.entityId && !board && !document.loading) || Boolean(route.itemId && board && !board.placements.some((p) => p.id === route.itemId));
  const activeLevel = board?.level ?? level;
  useEffect(() => { actions.setSelected(route.itemId ? [route.itemId] : []); }, [route.entityId, route.itemId]); // URL restores the selected placement.
  useEffect(() => { heading.current?.focus(); }, [route.entityId]);
  const boards = document.value.boards.filter((b) => b.level === activeLevel);
  const switchLevel = (next: StormLevel) => {
    setLevel(next);
    const related = document.value.boards.find((b) => b.level === next && (b.sourceBoardId === board?.id || b.id === board?.sourceBoardId));
    navigate(stormPath(related?.id));
  };
  const edge = board?.connections.find((c) => actions.selected.includes(c.id));
  return <section className="storm-workspace" aria-label="Event Storming workspace">
    <StormHeader board={board} heading={heading} document={document} activeLevel={activeLevel} switchLevel={switchLevel} navigate={navigate} readOnly={readOnly} actions={actions} />
    {locked && <p className="storm-lock" role="status">Read only while an Environment Run is active. You can explore every board.</p>}
    <StormFileFeedback document={document} />
    {invalid ? <div className="storm-recovery"><h2>Board or note not found</h2><p>The link may refer to a removed item.</p><Button onClick={() => navigate(stormPath(board?.id))}>Return to {board ? "board" : "Event Storming"}</Button></div>
      : board ? <>
        <div className="storm-board-meta"><span>{LEVELS[board.level].hint}</span>{board.sourceBoardId && <Button variant="link" onClick={() => navigate(stormPath(board.sourceBoardId))}>Source board <ArrowUpRight /></Button>}
          <Button variant="ghost" onClick={() => setLibrary(true)}>Find a note</Button><Button variant="ghost" disabled={readOnly} onClick={() => actions.action("delete-board")}>Delete board</Button></div>
        <div className="storm-stage">
          <StormCanvas key={board.id} value={document.value} board={board} focusId={route.itemId} actions={actions} locked={readOnly} undo={document.store.undo} redo={document.store.redo} />
          <StormTools board={board} actions={actions} locked={readOnly} search={() => setLibrary(true)} link={() => setConnect(true)} />
          {edge && <div className="storm-edge-editor"><label>Connection label<input aria-label="Edit connection label" value={edge.label} readOnly={readOnly} maxLength={500} onChange={(event) => actions.mutate((b) => { b.connections.find((c) => c.id === edge.id)!.label = event.target.value; })} /></label><Button disabled={readOnly} variant="ghost" onClick={() => actions.action("remove")}>Remove connection</Button></div>}
        </div>
        {connect && <StormConnectDialog open close={() => setConnect(false)} board={board} value={document.value} actions={actions} locked={readOnly} />}
        <StormDeleteDialog value={document.value} board={board} actions={actions} locked={readOnly} />
      </> : !document.loading && <div className="storm-overview">
        <div className="storm-overview-intro"><div className="storm-wall-mark" aria-hidden="true"><i className="storm-color-event">Something<br />happened.</i><i className="storm-color-command">What<br />happens next?</i><i className="storm-color-hotspot">?</i></div>
          <div><span className="storm-eyebrow">{LEVELS[activeLevel].label}</span><h2>{LEVELS[activeLevel].hint}</h2><p>Bring the people. Capture the events. Make the connections.</p><Button disabled={readOnly} onClick={() => actions.addBoard(activeLevel)}><Plus />Create {LEVELS[activeLevel].label} board</Button></div></div>
        <div className="storm-board-cards">{boards.map((b) => <button className="storm-board-card" key={b.id} onClick={() => navigate(stormPath(b.id))}>
          <div className="storm-board-preview" aria-hidden="true">{b.placements.slice(0, 12).map((p) => <i key={p.id} className={`storm-color-${document.value.notes.find((n) => n.id === p.noteId)?.kind ?? "note"}`} />)}</div>
          <strong>{b.title}</strong><span>{b.placements.length} notes · {b.connections.length} connections <ArrowUpRight /></span>
        </button>)}</div>
        <Button variant="ghost" onClick={() => setLibrary(true)}>Find shared notes across all boards</Button>
      </div>}
    <StormLibrary open={library} close={() => setLibrary(false)} value={document.value} board={board} actions={actions} locked={readOnly} navigate={navigate} />
  </section>;
}
