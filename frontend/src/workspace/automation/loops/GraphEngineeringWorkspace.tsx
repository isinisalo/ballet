import { useEffect, useState, type ReactNode } from "react";
import { ArrowDownLeft, ArrowUpRight, Download, LockKeyhole, PanelRightClose, PanelTopOpen, Route, Settings2 } from "lucide-react";
import type {
  ExecutionProfile,
  InstalledLoopModuleStatus,
  LocalRuntime,
  ProjectAutomationConfig,
  ProjectInstruction,
  Skill,
  LoopTheme
} from "@shared/api/workspace-contracts";
import { DeleteAction } from "@/components/shared/workspace-ui";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { GraphEngineeringCanvas } from "./GraphEngineeringCanvas";
import { GraphOrchestratorInspector } from "./GraphOrchestratorInspector";
import { LoopEdgesEditor } from "./LoopEdgesEditor";
import type { GraphEngineeringEdge, GraphEngineeringProjection } from "./engineeringProjections";
import {
  addGraphTransition,
  addRepairEdge,
  removeGraphTransition,
  removeRepairEdge,
  updateGraphTransition,
  updateRepairEdge
} from "./loopEditorState";

interface GraphEngineeringWorkspaceProps {
  config: ProjectAutomationConfig;
  projection: GraphEngineeringProjection;
  selectedLoopId?: string;
  installedModules: InstalledLoopModuleStatus[];
  executionProfiles: ExecutionProfile[];
  instructions: ProjectInstruction[];
  skills: Skill[];
  runtime: LocalRuntime;
  theme: LoopTheme;
  disabled: boolean;
  lockedLoopIds: ReadonlySet<string>;
  onSelectLoop: (loopId: string) => void;
  onOpenLoop: (loopId: string) => void;
  onConfigChange: (config: ProjectAutomationConfig) => void;
  onDeleteLoop: (loopId: string) => unknown | Promise<unknown>;
  onExportLoop?: (loopId: string) => unknown | Promise<unknown>;
  onRemoveInstalledLoop?: (loopId: string) => unknown | Promise<unknown>;
}

export function GraphEngineeringWorkspace({
  config,
  projection,
  selectedLoopId,
  installedModules,
  executionProfiles,
  instructions,
  skills,
  runtime,
  theme,
  disabled,
  lockedLoopIds,
  onSelectLoop,
  onOpenLoop,
  onConfigChange,
  onDeleteLoop,
  onExportLoop,
  onRemoveInstalledLoop
}: GraphEngineeringWorkspaceProps) {
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);
  const [desktopInspectorOpen, setDesktopInspectorOpen] = useState(Boolean(selectedLoopId));
  const [narrow, setNarrow] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<"loop" | "orchestrator">(selectedLoopId ? "loop" : "orchestrator");
  const selectedLoop = config.loops.find((loop) => loop.id === selectedLoopId);
  const selectedModule = installedModules.find((module) => module.loopId === selectedLoopId);
  const allEdges = projection.edges;
  const incoming = allEdges.filter((edge) => edge.targetId === selectedLoopId);
  const outgoing = allEdges.filter((edge) => edge.source === selectedLoopId);
  const connectionLocked = Boolean(selectedLoopId && (
    lockedLoopIds.has(selectedLoopId) || [...incoming, ...outgoing].some((edge) =>
      lockedLoopIds.has(edge.source) || lockedLoopIds.has(edge.targetId))
  ));
  useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)");
    const update = () => setNarrow(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    setInspectorTab(selectedLoopId ? "loop" : "orchestrator");
    if (selectedLoopId && !narrow) setDesktopInspectorOpen(true);
  }, [narrow, selectedLoopId]);

  const selectLoop = (loopId: string) => {
    setInspectorTab("loop");
    onSelectLoop(loopId);
    if (narrow) setMobileInspectorOpen(true);
    else setDesktopInspectorOpen(true);
  };
  const selectEdge = (edge: GraphEngineeringEdge) => {
    setInspectorTab("loop");
    onSelectLoop(edge.source);
    if (narrow) setMobileInspectorOpen(true);
    else setDesktopInspectorOpen(true);
  };
  const loopInspector = selectedLoop ? (
    <GraphLoopInspector
      config={config}
      loopId={selectedLoop.id}
      installed={selectedModule}
      incoming={incoming}
      outgoing={outgoing}
      disabled={disabled || connectionLocked}
      onOpen={() => onOpenLoop(selectedLoop.id)}
      onConfigChange={onConfigChange}
      onExport={onExportLoop ? () => onExportLoop(selectedLoop.id) : undefined}
      onDelete={selectedModule && onRemoveInstalledLoop
        ? () => onRemoveInstalledLoop(selectedLoop.id)
        : () => onDeleteLoop(selectedLoop.id)}
    />
  ) : <div className="p-4 text-sm text-muted-foreground">Select a LoopNode to inspect its project-global connections. Press Enter on a selected canvas node to open Workflow Engineering.</div>;
  const orchestratorInspector = <GraphOrchestratorInspector
    config={config} projection={projection} profiles={executionProfiles} instructions={instructions}
    skills={skills} runtime={runtime} disabled={disabled} onConfigChange={onConfigChange}
  />;
  const inspector = inspectorTab === "loop" ? loopInspector : orchestratorInspector;
  const selectOrchestrator = () => {
    setInspectorTab("orchestrator");
    if (narrow) setMobileInspectorOpen(true);
    else setDesktopInspectorOpen(true);
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col p-3 sm:p-4 md:overflow-hidden">
      <div className={cn(
        "grid min-h-[34rem] min-w-0 flex-1 overflow-hidden",
        desktopInspectorOpen ? "lg:grid-cols-[minmax(0,1fr)_22rem]" : "lg:grid-cols-1"
      )}>
        <GraphEngineeringCanvas
          projection={projection} narrow={narrow} selectedLoopId={selectedLoopId}
          orchestratorSelected={desktopInspectorOpen && inspectorTab === "orchestrator"}
          theme={theme} onSelectLoop={selectLoop} onOpenLoop={onOpenLoop}
          onSelectEdge={selectEdge} onSelectOrchestrator={selectOrchestrator}
        />
        <aside aria-label="Graph Engineering Loop and Orchestrator inspector" className={cn(
          "hidden min-h-0 flex-col overflow-hidden border-y border-r border-divider-strong bg-popover",
          desktopInspectorOpen && "lg:flex"
        )}>
          <InspectorTabs
            selected={inspectorTab} loopAvailable={Boolean(selectedLoop)} onSelect={setInspectorTab}
            onClose={() => setDesktopInspectorOpen(false)}
          />
          <div className="min-h-0 flex-1 overflow-y-auto">{inspector}</div>
        </aside>
      </div>
      {narrow ? <Sheet open={mobileInspectorOpen} onOpenChange={setMobileInspectorOpen}>
        <SheetContent className="overflow-x-hidden overflow-y-auto p-0 data-[side=right]:w-[calc(100%-1rem)] data-[side=right]:max-w-md">
          <SheetHeader className="border-b border-divider-strong pr-12">
            <SheetTitle>Graph Engineering inspector</SheetTitle>
            <SheetDescription>{inspectorTab === "loop" ? "Named RunBook transitions, repair routes and Loop metadata." : "Graph identity, start Loop and RunBook policy."}</SheetDescription>
          </SheetHeader>
          <InspectorTabs selected={inspectorTab} loopAvailable={Boolean(selectedLoop)} onSelect={setInspectorTab} />
          {inspector}
        </SheetContent>
      </Sheet> : null}
    </div>
  );
}

function InspectorTabs({ selected, loopAvailable, onSelect, onClose }: {
  selected: "loop" | "orchestrator";
  loopAvailable: boolean;
  onSelect: (tab: "loop" | "orchestrator") => void;
  onClose?: () => void;
}) {
  return <div role="tablist" aria-label="Graph Engineering inspector sections" className={cn(
    "grid shrink-0 border-b border-divider-strong bg-card p-1",
    onClose ? "grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]" : "grid-cols-2"
  )}>
    <Button type="button" role="tab" size="sm" className="max-sm:h-10" variant={selected === "loop" ? "secondary" : "ghost"} aria-selected={selected === "loop"} disabled={!loopAvailable} onClick={() => onSelect("loop")}><Route /> Selected Loop</Button>
    <Button type="button" role="tab" size="sm" className="max-sm:h-10" variant={selected === "orchestrator" ? "secondary" : "ghost"} aria-selected={selected === "orchestrator"} onClick={() => onSelect("orchestrator")}><Settings2 /> Orchestrator</Button>
    {onClose ? <Button type="button" size="icon-sm" variant="ghost" aria-label="Close inspector" onClick={onClose}><PanelRightClose /></Button> : null}
  </div>;
}

function GraphLoopInspector({ config, loopId, installed, incoming, outgoing, disabled, onOpen, onConfigChange, onExport, onDelete }: {
  config: ProjectAutomationConfig;
  loopId: string;
  installed?: InstalledLoopModuleStatus;
  incoming: GraphEngineeringEdge[];
  outgoing: GraphEngineeringEdge[];
  disabled: boolean;
  onOpen: () => void;
  onConfigChange: (config: ProjectAutomationConfig) => void;
  onExport?: () => unknown | Promise<unknown>;
  onDelete: () => unknown | Promise<unknown>;
}) {
  const loop = config.loops.find((candidate) => candidate.id === loopId);
  if (!loop) return null;
  return (
    <div className="grid min-w-0">
      <header className="grid gap-2 p-4">
        <div className="flex min-w-0 items-center gap-2"><Route className="size-4 shrink-0 text-primary" /><h2 className="truncate text-base font-semibold">{installed?.title ?? loop.id}</h2></div>
        {installed?.title && installed.title !== loop.id ? <p className="truncate font-mono text-[0.68rem] text-muted-foreground">{loop.id}</p> : null}
        <p className="text-xs leading-5 text-muted-foreground">{loop.description}</p>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline">{installed ? "Installed module" : "Custom Loop"}</Badge>
          {installed ? <><Badge variant="outline">v{installed.moduleVersion}</Badge><Badge variant="secondary">{installed.status}</Badge></> : null}
          <Badge variant="outline">{loop.workflow.jobNodes.length} Jobs</Badge>
        </div>
        {installed?.capabilities.requires.length ? <Metadata label="Requires" values={installed.capabilities.requires} /> : null}
        {installed?.capabilities.provides.length ? <Metadata label="Provides" values={installed.capabilities.provides} /> : null}
        {disabled ? <Alert className="border-tertiary/40 text-tertiary"><LockKeyhole /><AlertDescription>A connected Loop has an active Run. Relevant Loop and Loop Edge mutations are locked.</AlertDescription></Alert> : null}
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" className="flex-1" onClick={onOpen}><PanelTopOpen /> Open Workflow Engineering</Button>
          {onExport ? <Button type="button" size="icon-sm" variant="outline" disabled={disabled} aria-label={`Export Loop ${loop.id}`} title="Export" onClick={() => void onExport()}><Download /></Button> : null}
          <DeleteAction deleteLabel={`${installed ? "Remove installed" : "Delete custom"} Loop ${loop.id}`} deleteType="Loop" resourceName={loop.id} disabled={disabled} onDelete={onDelete} />
        </div>
      </header>
      <ConnectionSummary title="Incoming routes" icon={<ArrowDownLeft />} edges={incoming} empty="No incoming RunBook or repair route." />
      <ConnectionSummary title="Outgoing routes" icon={<ArrowUpRight />} edges={outgoing} empty="No outgoing RunBook or repair route." />
      <div className="border-t border-divider-strong p-4">
        <LoopEdgesEditor
          config={config}
          sourceLoopId={loop.id}
          disabled={disabled}
          onAddTransition={() => onConfigChange(addGraphTransition(config, loop.id))}
          onChangeTransition={(edgeId, edge) => onConfigChange(updateGraphTransition(config, edgeId, edge))}
          onRemoveTransition={(edgeId) => onConfigChange(removeGraphTransition(config, edgeId))}
          onAddRepair={() => onConfigChange(addRepairEdge(config, loop.id))}
          onChangeRepair={(edgeId, edge) => onConfigChange(updateRepairEdge(config, edgeId, edge))}
          onRemoveRepair={(edgeId) => onConfigChange(removeRepairEdge(config, edgeId))}
        />
      </div>
    </div>
  );
}

function ConnectionSummary({ title, icon, edges, empty }: { title: string; icon: ReactNode; edges: GraphEngineeringEdge[]; empty: string }) {
  return (
    <section className="grid gap-2 border-t border-divider-strong p-4">
      <h3 className="flex items-center gap-2 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground"><span className="[&_svg]:size-3">{icon}</span>{title}</h3>
      {edges.length ? <ul className="grid min-w-0 gap-1.5">{edges.map((edge) => <li key={edge.id} className="min-w-0 rounded border border-divider-strong bg-background px-2 py-1.5 text-xs" aria-label={edge.kind === "transition" ? `${edge.decision} outcome ${edge.outcome}, ${edge.source} to ${edge.targetId}` : `Repair capability ${edge.capability}, ${edge.source} to ${edge.target}`}><div className="flex min-w-0 items-center gap-2"><span className={cn("shrink-0 font-mono", edge.kind === "repair" ? "text-tertiary" : edge.decision === "PASS" ? "text-secondary" : "text-error")}>{edge.kind === "repair" ? "REPAIR" : `${edge.decision} · ${edge.outcome}`}</span><span className="min-w-0 flex-1 truncate text-right font-mono text-[0.65rem] text-muted-foreground" title={`${edge.source} → ${edge.targetId}`}>{edge.source} → {edge.targetId === "graph-done" ? "DONE" : edge.targetId}</span></div>{edge.kind === "repair" ? <p className="mt-1 break-words font-mono text-[0.65rem] text-foreground">{edge.capability}</p> : null}<p className="mt-1 break-words text-muted-foreground">{edge.description}</p><span className="mt-1 block font-mono text-[0.58rem] uppercase text-muted-foreground">persisted {edge.kind === "repair" ? "repair allowlist" : "RunBook transition"} · {edge.id}</span></li>)}</ul> : <p className="text-xs text-muted-foreground">{empty}</p>}
    </section>
  );
}

function Metadata({ label, values }: { label: string; values: string[] }) {
  return <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2 text-xs"><span className="font-mono text-[0.65rem] uppercase text-muted-foreground">{label}</span><span className="min-w-0 break-words font-mono text-[0.68rem]">{values.join(", ")}</span></div>;
}
