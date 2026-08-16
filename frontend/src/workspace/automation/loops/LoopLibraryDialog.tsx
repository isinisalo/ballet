import { useEffect, useMemo, useRef, useState } from "react";
import { FileJson, Library, Network, Plus, Search, ShieldCheck, TriangleAlert } from "lucide-react";
import type {
  InstalledLoopModuleStatus,
  LoopModuleInspection,
  LoopModuleInstallCommitRequest,
  LoopModuleInstallPlan,
  LoopModuleInstallPlanRequest,
  LoopModuleLibraryEntry
} from "@shared/api/workspace-contracts";
import { SelectField } from "@/components/shared/workspace-ui";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toErrorMessage } from "@/lib/errors";

export interface LoopModuleActions {
  listLibrary: () => Promise<LoopModuleLibraryEntry[]>;
  inspect: (input: { package: unknown; source?: string }) => Promise<LoopModuleInspection>;
  plan: (input: LoopModuleInstallPlanRequest) => Promise<LoopModuleInstallPlan>;
  install: (input: LoopModuleInstallCommitRequest) => Promise<InstalledLoopModuleStatus>;
  statuses: () => Promise<InstalledLoopModuleStatus[]>;
  exportLoop: (input: { loopId: string }) => Promise<{ canonicalJson: string; filename: string }>;
  remove: (loopId: string) => Promise<void>;
}

export function LoopLibraryDialog({ open, actions, onOpenChange, onCreateBlank, onInstalled }: {
  open: boolean;
  actions: LoopModuleActions;
  onOpenChange: (open: boolean) => void;
  onCreateBlank: () => void;
  onInstalled: (installed: InstalledLoopModuleStatus) => void | Promise<void>;
}) {
  const [library, setLibrary] = useState<LoopModuleLibraryEntry[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [plan, setPlan] = useState<LoopModuleInstallPlan>();
  const [selectedPackage, setSelectedPackage] = useState<{ package: unknown; source: string }>();
  const [profileMappings, setProfileMappings] = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true); setError(""); setPlan(undefined); setSelectedPackage(undefined);
    void actions.listLibrary().then((entries) => { if (active) setLibrary(entries); })
      .catch((reason) => { if (active) setError(toErrorMessage(reason, "Unable to load Loop Library.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [actions, open]);

  const categories = useMemo(() => [...new Set(library.flatMap((entry) => entry.manifest?.category ? [entry.manifest.category] : []))].sort(), [library]);
  const visible = library.filter((entry) => {
    const needle = query.trim().toLowerCase();
    return (category === "all" || entry.manifest?.category === category)
      && (!needle || [entry.manifest?.title, entry.manifest?.description, ...(entry.manifest?.tags ?? [])]
        .filter(Boolean).join(" ").toLowerCase().includes(needle));
  });

  const prepare = async (pkg: unknown, source: string, mappings: Record<string, string> = {}) => {
    setPending(true); setError("");
    try {
      const next = await actions.plan({ package: pkg, source, profileMappings: mappings });
      setSelectedPackage({ package: pkg, source }); setProfileMappings(mappings);
      setPlan(next);
    } catch (reason) { setError(toErrorMessage(reason, "Unable to prepare Loop module install.")); }
    finally { setPending(false); }
  };

  const commit = async (next: LoopModuleInstallPlan, pkg: unknown, source: string, mappings: Record<string, string>) => {
    const installed = await actions.install({ package: pkg, source, profileMappings: mappings, expectedPlanHash: next.planHash });
    await onInstalled(installed);
    onOpenChange(false);
  };

  const replan = async (slot: string, profileId: string) => {
    if (!selectedPackage) return;
    const mappings = { ...profileMappings, [slot]: profileId };
    setProfileMappings(mappings); setPending(true); setError("");
    try { setPlan(await actions.plan({ ...selectedPackage, profileMappings: mappings })); }
    catch (reason) { setError(toErrorMessage(reason, "Unable to update profile mapping.")); }
    finally { setPending(false); }
  };

  const importFile = async (file?: File) => {
    if (!file) return;
    setPending(true); setError("");
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
      const pkg = JSON.parse(text) as unknown;
      const inspection = await actions.inspect({ package: pkg, source: `local-file:${file.name}` });
      if (!inspection.valid || !inspection.package) {
        setError(inspection.issues.map((issue) => `${issue.code}: ${issue.message}`).join(" "));
        return;
      }
      await prepare(inspection.package, `local-file:${file.name}`);
    } catch (reason) { setError(toErrorMessage(reason, "Import file is not valid JSON.")); }
    finally { setPending(false); if (inputRef.current) inputRef.current.value = ""; }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(52rem,calc(100dvh-1rem))] w-[min(80rem,calc(100vw-1rem))] max-w-none flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-divider-strong p-4 pr-12">
          <DialogTitle className="flex items-center gap-2"><Library className="size-4 text-primary" /> Loop Library</DialogTitle>
          <DialogDescription>Add one ready module, import a local package, or author a blank Loop.</DialogDescription>
        </DialogHeader>
        <div className="flex shrink-0 flex-wrap items-stretch gap-3 border-b border-divider-strong p-4 sm:p-5">
          <label className="relative min-w-64 flex-[1_1_20rem]">
            <span className="sr-only">Search Loop Library</span><Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search modules" className="pl-8" />
          </label>
          <input ref={inputRef} className="sr-only" type="file" accept=".json,.ballet-loop.json,application/json" aria-label="Import Loop module file" onChange={(event) => void importFile(event.target.files?.[0])} />
          <Button type="button" variant="outline" className="min-w-fit flex-1 whitespace-nowrap sm:flex-none" onClick={() => inputRef.current?.click()} disabled={pending}><FileJson /> Import file</Button>
          <Button type="button" variant="outline" className="min-w-fit flex-1 whitespace-nowrap sm:flex-none" onClick={onCreateBlank}><Plus /> Create blank Loop</Button>
        </div>
        {categories.length ? <div className="flex shrink-0 gap-2 overflow-x-auto px-4 py-3 sm:px-5" aria-label="Loop module categories">
          {["all", ...categories].map((value) => <Button key={value} type="button" size="xs" variant={category === value ? "secondary" : "ghost"} onClick={() => setCategory(value)}>{value === "all" ? "All" : value}</Button>)}
        </div> : null}
        {error ? <Alert variant="destructive" className="mx-4 mt-3"><TriangleAlert /><AlertDescription>{error}</AlertDescription></Alert> : null}
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-5">
          {plan ? <InstallPreview plan={plan} pending={pending} onMap={replan} onBack={() => setPlan(undefined)} onInstall={() => selectedPackage && void (async () => {
            setPending(true); setError("");
            try { await commit(plan, selectedPackage.package, selectedPackage.source, profileMappings); }
            catch (reason) { setError(toErrorMessage(reason, "Unable to install Loop module.")); }
            finally { setPending(false); }
          })()} /> : (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))] gap-4" role="list" aria-label="Available Loop modules" aria-busy={loading || pending}>
              {visible.map((entry) => <ModuleCard key={entry.source} entry={entry} disabled={pending} onAdd={() => entry.package && void prepare(entry.package, entry.source)} />)}
              {!loading && visible.length === 0 ? <p className="col-span-full py-10 text-center text-sm text-muted-foreground">No matching Loop modules.</p> : null}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ModuleCard({ entry, disabled, onAdd }: { entry: LoopModuleLibraryEntry; disabled: boolean; onAdd: () => void }) {
  return <article className="grid min-h-52 min-w-0 grid-rows-[auto_1fr_auto] rounded-lg border border-divider-strong bg-card p-4" role="listitem">
    <header className="grid min-w-0 gap-1"><h3 className="break-words font-mono text-sm font-semibold leading-5">{entry.manifest?.title ?? entry.source}</h3><p className="line-clamp-2 break-words text-xs leading-4 text-muted-foreground">{entry.manifest?.description ?? entry.issues[0]?.message}</p></header>
    <div className="flex content-start flex-wrap gap-1.5 py-3">
      {entry.manifest ? <><Badge variant="outline">v{entry.manifest.version}</Badge>{entry.manifest.category ? <Badge variant="secondary">{entry.manifest.category}</Badge> : null}</> : null}
      {entry.permissions?.network === "required" ? <Badge variant="outline"><Network /> network</Badge> : null}
      <Badge variant="outline"><ShieldCheck /> no external writes</Badge>
    </div>
    <Button type="button" size="sm" disabled={disabled || !entry.valid || !entry.package} onClick={onAdd}>Add</Button>
  </article>;
}

function InstallPreview({ plan, pending, onMap, onBack, onInstall }: {
  plan: LoopModuleInstallPlan; pending: boolean;
  onMap: (slot: string, profileId: string) => void; onBack: () => void; onInstall: () => void;
}) {
  return <section aria-labelledby="install-preview-title" className="grid gap-4">
    <div><h3 id="install-preview-title" className="font-mono text-sm font-semibold">{plan.requiresPreview ? "Install preview" : "Confirm install"} · {plan.module.title}</h3><p className="mt-1 break-all font-mono text-[0.65rem] text-muted-foreground">source: {plan.source} · sha256: {plan.packageSha256}</p></div>
    <div className="flex flex-wrap gap-2" aria-label="Package permissions"><Badge variant="outline"><ShieldCheck /> external writes off</Badge><Badge variant="outline"><Network /> network {plan.permissions.network}</Badge></div>
    {plan.requiresPreview ? <div className="grid gap-3 sm:grid-cols-2">
      {plan.profileMappings.map((mapping) => <SelectField key={mapping.slot.key} label={mapping.slot.title} value={mapping.selectedProfileId ?? ""} options={mapping.candidates.map((candidate) => ({ value: candidate.id, label: `${candidate.name} · network ${candidate.networkAccess ? "on" : "off"}` }))} required error={mapping.issue?.message} disabled={pending} onChange={(value) => void onMap(mapping.slot.key, value)} />)}
    </div> : null}
    {plan.issues.length ? <Alert variant="destructive"><TriangleAlert /><AlertDescription>{plan.issues.map((issue) => `${issue.code}: ${issue.message}`).join(" ")}</AlertDescription></Alert> : null}
    <div className="rounded-lg border border-divider-strong bg-background p-3 text-xs">
      <strong className="font-mono">Exact diff</strong>
      <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground"><li>Add Loop {plan.loop.id}</li>{plan.diff.projectFilesCreated.map((file) => <li key={file} className="break-all">Create {file}</li>)}{plan.diff.provenanceFilesChanged.map((file) => <li key={file} className="break-all">Update {file}</li>)}<li>Update .ballet/project.json last</li></ul>
    </div>
    <details className="rounded-lg border border-divider-strong p-3 text-xs"><summary className="cursor-pointer font-mono">Advanced metadata</summary><pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap break-all text-[0.65rem] text-muted-foreground">{JSON.stringify({ idRemapping: plan.idRemapping, permissions: plan.permissions, stateContract: plan.stateContract, capabilities: plan.capabilities, conflicts: plan.conflicts }, null, 2)}</pre></details>
    <DialogFooter><Button type="button" variant="outline" onClick={onBack} disabled={pending}>Back</Button><Button type="button" onClick={onInstall} disabled={pending || !plan.canInstall}>Install module</Button></DialogFooter>
  </section>;
}
