import { useEffect, useState, type ReactNode } from "react";
import { ArrowDownLeft, ArrowUpRight, Download, LockKeyhole, PanelTopOpen, Route, Settings2 } from "lucide-react";
import type {
  ExecutionProfile,
  InstalledLoopModuleStatus,
  LocalRuntime,
  ProjectAutomationConfig,
  ProjectInstruction,
  ProjectLoopEdge,
  Skill,
  LoopTheme
} from "@shared/api/workspace-contracts";
import { DeleteAction } from "@/components/shared/workspace-ui";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { LoopCompositionCanvas } from "./LoopCompositionCanvas";
import { LoopEdgesEditor } from "./LoopEdgesEditor";
import { LoopOrchestratorEditor } from "./LoopOrchestratorEditor";
import type { LoopCompositionProjection } from "./loopEngineerProjections";
import { addLoopEdge, removeLoopEdge, updateLoopEdge } from "./loopEditorState";

export function LoopCompositionWorkspace({
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
}: {
  config: ProjectAutomationConfig;
  projection: LoopCompositionProjection;
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
}) {
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<"loop" | "orchestrator">(selectedLoopId ? "loop" : "orchestrator");
  const selectedLoop = config.loops.find((loop) => loop.id === selectedLoopId);
  const selectedModule = installedModules.find((module) => module.loopId === selectedLoopId);
  const incoming = config.loopEdges.filter((edge) => edge.target === selectedLoopId);
  const outgoing = config.loopEdges.filter((edge) => edge.source === selectedLoopId);
  const connectionLocked = Boolean(selectedLoopId && (
    lockedLoopIds.has(selectedLoopId) || [...incoming, ...outgoing].some((edge) => lockedLoopIds.has(edge.source) || lockedLoopIds.has(edge.target))
  ));

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)");
    const update = () => setNarrow(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => setInspectorTab(selectedLoopId ? "loop" : "orchestrator"), [selectedLoopId]);

  const selectLoop = (loopId: string) => {
    setInspectorTab("loop");
    onSelectLoop(loopId);
    if (narrow) setMobileInspectorOpen(true);
  };
  const selectEdge = (edge: ProjectLoopEdge) => {
    setInspectorTab("loop");
    onSelectLoop(edge.source);
    if (narrow) setMobileInspectorOpen(true);
  };
  const loopInspector = selectedLoop ? (
    <LoopCompositionInspector
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
  ) : <div className="p-4 text-sm text-muted-foreground">Select a Loop Node to inspect its project-global connections. Press Enter on a selected canvas node to open Level 2.</div>;
  const orchestratorInspector = <div className="p-4"><LoopOrchestratorEditor
    value={config.orchestrator}
    profiles={executionProfiles}
    instructions={instructions}
    skills={skills}
    runtime={runtime}
    disabled={disabled}
    onChange={(orchestrator) => onConfigChange({ ...config, orchestrator })}
  /></div>;
  const inspector = inspectorTab === "loop" ? loopInspector : orchestratorInspector;
  const openOrchestrator = () => {
    setInspectorTab("orchestrator");
    setMobileInspectorOpen(true);
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col p-3 sm:p-4 md:overflow-hidden">
      <div className="grid min-h-[34rem] min-w-0 flex-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_22rem]">
        <LoopCompositionCanvas projection={projection} selectedLoopId={selectedLoopId} theme={theme} onSelectLoop={selectLoop} onOpenLoop={onOpenLoop} onSelectEdge={selectEdge} onOpenOrchestrator={openOrchestrator} />
        <aside aria-label="Level 1 Loop and Orchestrator inspector" className="hidden min-h-0 flex-col overflow-hidden border-y border-r border-divider-strong bg-popover lg:flex">
          <InspectorTabs selected={inspectorTab} loopAvailable={Boolean(selectedLoop)} onSelect={setInspectorTab} />
          <div className="min-h-0 flex-1 overflow-y-auto">{inspector}</div>
        </aside>
      </div>
      {narrow ? <Sheet open={mobileInspectorOpen} onOpenChange={setMobileInspectorOpen}>
        <SheetContent className="overflow-x-hidden overflow-y-auto p-0 data-[side=right]:w-[calc(100%-1rem)] data-[side=right]:max-w-md">
          <SheetHeader className="border-b border-divider-strong pr-12">
            <SheetTitle>Level 1 inspector</SheetTitle>
            <SheetDescription>{inspectorTab === "loop" ? "Project-global Loop Edges and black box metadata." : "Project-global repair routing settings."}</SheetDescription>
          </SheetHeader>
          <InspectorTabs selected={inspectorTab} loopAvailable={Boolean(selectedLoop)} onSelect={setInspectorTab} />
          {inspector}
        </SheetContent>
      </Sheet> : null}
    </div>
  );
}

function InspectorTabs({ selected, loopAvailable, onSelect }: {
  selected: "loop" | "orchestrator";
  loopAvailable: boolean;
  onSelect: (tab: "loop" | "orchestrator") => void;
}) {
  return <div role="tablist" aria-label="Level 1 inspector sections" className="grid shrink-0 grid-cols-2 border-b border-divider-strong bg-card p-1">
    <Button type="button" role="tab" size="sm" variant={selected === "loop" ? "secondary" : "ghost"} aria-selected={selected === "loop"} disabled={!loopAvailable} onClick={() => onSelect("loop")}><Route /> Selected Loop</Button>
    <Button type="button" role="tab" size="sm" variant={selected === "orchestrator" ? "secondary" : "ghost"} aria-selected={selected === "orchestrator"} onClick={() => onSelect("orchestrator")}><Settings2 /> Orchestrator</Button>
  </div>;
}

function LoopCompositionInspector({ config, loopId, installed, incoming, outgoing, disabled, onOpen, onConfigChange, onExport, onDelete }: {
  config: ProjectAutomationConfig;
  loopId: string;
  installed?: InstalledLoopModuleStatus;
  incoming: ProjectLoopEdge[];
  outgoing: ProjectLoopEdge[];
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
          <Badge variant="outline">{loop.nodes.length} Work Loop Nodes</Badge>
        </div>
        {installed?.capabilities.requires.length ? <Metadata label="Requires" values={installed.capabilities.requires} /> : null}
        {installed?.capabilities.provides.length ? <Metadata label="Provides" values={installed.capabilities.provides} /> : null}
        {disabled ? <Alert className="border-tertiary/40 text-tertiary"><LockKeyhole /><AlertDescription>A connected Loop has an active Run. Relevant Loop and Loop Edge mutations are locked.</AlertDescription></Alert> : null}
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" className="flex-1" onClick={onOpen}><PanelTopOpen /> Open detail</Button>
          {onExport ? <Button type="button" size="icon-sm" variant="outline" disabled={disabled} aria-label={`Export Loop ${loop.id}`} title="Export" onClick={() => void onExport()}><Download /></Button> : null}
          <DeleteAction deleteLabel={`${installed ? "Remove installed" : "Delete custom"} Loop ${loop.id}`} deleteType="Loop" resourceName={loop.id} disabled={disabled} onDelete={onDelete} />
        </div>
      </header>
      <ConnectionSummary title="Incoming Loop Edges" icon={<ArrowDownLeft />} edges={incoming} empty="No incoming Loop Edges." />
      <ConnectionSummary title="Outgoing Loop Edges" icon={<ArrowUpRight />} edges={outgoing} empty="No outgoing Loop Edges." />
      <div className="border-t border-divider-strong p-4">
        <LoopEdgesEditor
          config={config}
          sourceLoopId={loop.id}
          disabled={disabled}
          onAdd={() => onConfigChange(addLoopEdge(config, loop.id))}
          onChange={(edgeId, edge) => onConfigChange(updateLoopEdge(config, edgeId, edge))}
          onRemove={(edgeId) => onConfigChange(removeLoopEdge(config, edgeId))}
        />
      </div>
    </div>
  );
}

function ConnectionSummary({ title, icon, edges, empty }: { title: string; icon: ReactNode; edges: ProjectLoopEdge[]; empty: string }) {
  return (
    <section className="grid gap-2 border-t border-divider-strong p-4">
      <h3 className="flex items-center gap-2 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground"><span className="[&_svg]:size-3">{icon}</span>{title}</h3>
      {edges.length ? <ul className="grid min-w-0 gap-1.5">{edges.map((edge) => <li key={edge.id} className="min-w-0 rounded border border-divider-strong bg-background px-2 py-1.5 text-xs"><div className="flex min-w-0 items-center gap-2"><span className={cn("shrink-0 font-mono", edge.kind === "repair" ? "text-tertiary" : "text-loop-flow")}>{edge.kind}</span><span className="min-w-0 flex-1 truncate text-right font-mono text-[0.65rem] text-muted-foreground" title={`${edge.source} → ${edge.target}`}>{edge.source} → {edge.target}</span></div><p className="mt-1 break-words text-muted-foreground">{edge.description}</p></li>)}</ul> : <p className="text-xs text-muted-foreground">{empty}</p>}
    </section>
  );
}

function Metadata({ label, values }: { label: string; values: string[] }) {
  return <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2 text-xs"><span className="font-mono text-[0.65rem] uppercase text-muted-foreground">{label}</span><span className="min-w-0 break-words font-mono text-[0.68rem]">{values.join(", ")}</span></div>;
}
