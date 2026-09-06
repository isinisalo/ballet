import { StormNavigation } from "./StormNavigation";
import { StormConnectDialog } from "./StormConnectDialog";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import type { RouteState } from "@/workspace/types";
import type { WorkspaceNavigation } from "@/workspace/useWorkspaceNavigation";
import { useStormDocument } from "./useStormDocument";
import { useStormActions } from "./useStormActions";
import { stormPath } from "./stormPresentation";
import { resolveStormView, invalidStormSelection, findStormSteps } from "./stormOperations";
import { StormCanvas } from "./StormCanvas";
import { StormTools } from "./StormTools";
import { StormFileFeedback } from "./StormFileFeedback";
import { StormOverview } from "./StormOverview";
import { StormDetails } from "./StormDetails";
import { useUserStories } from "../user-stories/useUserStories";
import "../user-stories/userStories.css";
import "./eventStorming.css";
export function EventStormingWorkspace({ route, locked, navigate, onDirty }: { route: RouteState; locked: boolean; navigate: WorkspaceNavigation["navigate"]; onDirty(value: boolean): void }) {
  const document = useStormDocument(locked, onDirty), model = document.model.value;
  const stories = useUserStories(), mobile = useIsMobile();
  const [search, setSearch] = useState(""), [details, setDetails] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const process = model.processes.find((p) => p.id === route.entityId);
  const view = useMemo(() => process ? resolveStormView(model, document.layout.value, process, route.stormViewId) : undefined, [model, document.layout.value, process, route.stormViewId]);
  const actions = useStormActions(process, view, document.store.edit, navigate, route.storyId);
  const readOnly = locked || document.model.conflict || !document.model.baseline;
  const invalid = !document.model.loading && invalidStormSelection(model, document.layout.value, route, stories.data);
  useEffect(() => { heading.current?.focus(); }, [route.entityId]);
  useEffect(() => {
    actions.setSelected(route.itemId && view ? view.placements.filter((p) => p.stepId === route.itemId).map((p) => p.id) : []);
    if (route.itemId) setDetails(true);
  }, [route.entityId, route.itemId, route.stormViewId]);
  const openStory = (id: string) => { void document.store.save().then(() => navigate(`/project/user-stories?id=${id}`)); };
  const panel = process && view ? <StormDetails model={model} process={process} view={view} stepId={route.itemId} actions={actions} edit={document.store.edit} locked={readOnly} stories={stories.data} openStory={openStory} /> : null;
  const status = (file: typeof document.model | typeof document.layout) => file.error ? "Save failed" : file.saving ? "Saving" : file.dirty ? "Unsaved" : file.loading ? "Loading" : "Saved";
  const results = findStormSteps(model, process, search);
  return <section className="storm-workspace" aria-label="Event Storming workspace">
    <header className="storm-header"><h1 ref={heading} tabIndex={-1}>Event Storming</h1><div className="storm-toolbar">
      <span role="status">Model: {status(document.model)} · Layout: {status(document.layout)}</span>
      <Button variant="outline" disabled={!process} onClick={() => navigate(stormPath(undefined, undefined, undefined, route.storyId))}>Overview</Button>
      <Button disabled={readOnly} onClick={actions.addProcess}>New process</Button>
      <Button variant="outline" disabled={locked || !document.canUndo} onClick={document.store.undo}>Undo</Button><Button variant="outline" disabled={locked || !document.canRedo} onClick={document.store.redo}>Redo</Button>
      <Button disabled={readOnly} onClick={() => void document.store.save()}>Save</Button>
    </div></header>
    <StormNavigation model={model} process={process} view={view} route={route} stories={stories.data} layout={document.layout.value} search={search} setSearch={setSearch} navigate={navigate} showDetails={() => setDetails(true)} />
    {locked && <p role="status">Read only while an Environment Run is active.</p>}
    <StormFileFeedback file={document.store.model} name="model" /><StormFileFeedback file={document.store.layout} name="layout" />
    {stories.error && <p role="alert">Story sources unavailable: {stories.error}</p>}
    {invalid ? <div role="alert"><h2>Process, step or presentation not found</h2><Button onClick={() => navigate(stormPath())}>Return to overview</Button></div>
      : !document.model.baseline ? <p role="status">{document.model.loading ? "Loading process map…" : "Repair the model file, then refresh to continue."}</p>
        : process && view ? <>
          <div className="storm-author-tools"><StormTools actions={actions} locked={readOnly} /><StormConnectDialog model={model} process={process} edit={document.store.edit} locked={readOnly} /></div>
          {search && <div className="storm-search-results" aria-label="Search results">{results.map((s) => <Button key={s.id} variant="outline" onClick={() => navigate(stormPath(process.id, s.id, view.id, route.storyId))}>{model.concepts.find((c) => c.id === s.conceptId)?.title}</Button>)}{!results.length && <span>No matching steps</span>}</div>}
          <div className="storm-stage"><StormCanvas key={view.id} model={model} view={view} focusId={route.itemId} storyId={route.storyId} actions={actions} showDetails={() => setDetails(true)} locked={readOnly || document.layout.conflict} undo={document.store.undo} redo={document.store.redo} />
            {!mobile && <aside className="storm-details" aria-label="Process and step details">{panel}</aside>}</div>
          <p className="storm-legend">◆ Event flow: solid arrow · Supporting information: dashed arrow · Responsibility: dotted arrow</p>
          {mobile && <Sheet open={details} onOpenChange={setDetails}><SheetContent side="bottom" className="storm-mobile-details"><SheetHeader><SheetTitle>Process and step details</SheetTitle><SheetDescription>Edit the selected process or step and read its linked stories.</SheetDescription></SheetHeader>{panel}</SheetContent></Sheet>}
        </> : <StormOverview model={model} search={search} storyId={route.storyId} select={(id) => navigate(stormPath(id, undefined, undefined, route.storyId))} />}
  </section>;
}
