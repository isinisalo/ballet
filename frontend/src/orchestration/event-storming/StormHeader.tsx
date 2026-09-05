import type { RefObject } from "react";
import { ArrowLeft, Plus, Undo2, Redo2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import type { StormBoard, StormLevel } from "@shared/orchestration/eventStorming";
import { LEVELS, stormPath } from "./stormPresentation";
import type { StormActions } from "./useStormActions";
import type { useStormDocument } from "./useStormDocument";

export function StormHeader({ board, heading, document, activeLevel, switchLevel, navigate, readOnly, actions }: {
  board?: StormBoard; heading: RefObject<HTMLHeadingElement>; document: ReturnType<typeof useStormDocument>;
  activeLevel: StormLevel; switchLevel(level: StormLevel): void; navigate(path: string): void; readOnly: boolean; actions: StormActions
}) {
  return (
    <header className="storm-header">
      <div className="storm-heading-row"><SidebarTrigger aria-label="Toggle sidebar" />
        {board && <Button variant="ghost" size="icon" aria-label="All Event Storming boards" onClick={() => navigate(stormPath())}><ArrowLeft /></Button>}
        <div><span className="storm-eyebrow">PROJECT / EVENT STORMING</span><h1 ref={heading} tabIndex={-1}>{board ? <input aria-label="Board name" value={board.title} maxLength={500} readOnly={readOnly} onChange={(event) => actions.mutate((b) => { b.title = event.target.value; })} /> : "A shared understanding, on one wall."}</h1></div>
        <div className="storm-save-state" role="status">{document.loading ? "Loading…" : document.error || document.conflict ? "Save failed" : document.dirty || document.saving ? "Saving…" : document.baseline?.contentHash === "absent" ? "Ready" : "Saved"}</div>
      </div>
      <div className="storm-toolbar">
        <div className="storm-levels" role="tablist" aria-label="Event Storming level" onKeyDown={(event) => {
          const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=tab]"));
          const current = tabs.indexOf(event.target as HTMLButtonElement);
          const next = { ArrowRight: (current + 1) % tabs.length, ArrowLeft: (current + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1 }[event.key];
          if (next !== undefined) { event.preventDefault(); tabs[next]?.focus(); tabs[next]?.click(); }
        }}>{(Object.keys(LEVELS) as StormLevel[]).map((entry, i) => <Button key={entry} variant="ghost" role="tab" tabIndex={entry === activeLevel ? 0 : -1} aria-selected={entry === activeLevel} onClick={() => switchLevel(entry)}><span>0{i + 1}</span>{LEVELS[entry].label}</Button>)}</div>
        <div className="storm-toolbar-actions">
          <select aria-label="Switch board" value={board?.id ?? ""} onChange={(event) => navigate(stormPath(event.target.value || undefined))}><option value="">All boards</option>{document.value.boards.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}</select>
          <Button variant="ghost" size="icon" aria-label="Undo" disabled={readOnly || !document.canUndo} onClick={document.store.undo}><Undo2 /></Button>
          <Button variant="ghost" size="icon" aria-label="Redo" disabled={readOnly || !document.canRedo} onClick={document.store.redo}><Redo2 /></Button>
          <Button variant="ghost" size="icon" aria-label="Refresh Event Storming file" onClick={document.refresh}><RefreshCw /></Button>
          <Button variant="outline" disabled={readOnly} onClick={() => actions.addBoard(activeLevel)}><Plus />Board</Button>
        </div>
      </div>
    </header>
  );
}
