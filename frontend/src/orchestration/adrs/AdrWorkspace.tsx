import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { nextAdrId } from "@shared/orchestration/adr";
import type { RouteState } from "@/workspace/types";
import type { WorkspaceNavigation } from "@/workspace/useWorkspaceNavigation";
import type { ResourceDocument } from "../types";
import { ConfigureHeader } from "../configure/ConfigureHeader";
import { ConfigureToolbar } from "../configure/ConfigureToolbar";
import { AdrEditor } from "./AdrEditor";
import { AdrLegend } from "./AdrFields";
import { ADR_PARTS, inspectAdr } from "./adrPresentation";
import "./adrs.css";

export function AdrWorkspace({ route, documents, navigate, onDirty, onSave, onDelete }: {
  route: RouteState; documents: ResourceDocument[]; navigate: WorkspaceNavigation["navigate"]; onDirty?(dirty: boolean): void;
  onSave(id: string, source: string, hash: string, creating: boolean): Promise<ResourceDocument>;
  onDelete(id: string, hash: string): Promise<void>;
}) {
  const container = useRef<HTMLDivElement>(null); const focusId = useRef<string | undefined>(undefined);
  const creating = route.createMode === "adr"; const editing = creating || Boolean(route.entityId);
  const current = documents.find(({ id }) => id === route.entityId);
  const previous = useRef<ResourceDocument | undefined>(undefined);
  useEffect(() => { if (current) previous.current = current; }, [current]);
  const selected = current ?? (previous.current?.id === route.entityId ? previous.current : undefined);
  useEffect(() => {
    if (!editing && focusId.current) {
      container.current?.querySelector<HTMLElement>(`#${focusId.current}`)?.focus(); focusId.current = undefined;
    }
  }, [editing, documents]);
  const back = () => navigate("/project/adrs");
  return <div ref={container} className="adr-workspace">
    <ConfigureHeader eyebrow="Project" title={creating ? "Uusi ADR" : editing ? "Muokkaa ADR:ää" : "ADRs"} description="Mitä on päätetty ja missä päätöstä sovelletaan." />
    {editing ? creating || selected ? <AdrEditor key={creating ? "new" : selected!.id} current={creating ? undefined : selected} unavailable={!creating && !current} initialId={nextAdrId(documents.map(({ id }) => id))} onDirty={onDirty} onBack={back}
      onSave={async (id, source, hash, create) => { await onSave(id, source, hash, create); onDirty?.(false); focusId.current = `card-${id}`; navigate("/project/adrs", { bypassBlocker: true }); }}
      onDelete={async (id, hash) => { await onDelete(id, hash); onDirty?.(false); navigate("/project/adrs", { bypassBlocker: true }); }} />
      : <div role="alert" className="adr-content">ADR puuttuu tai ei ole käytettävissä.<Button variant="outline" onClick={back}>Takaisin ADR-listaan</Button></div>
      : <><ConfigureToolbar status={`${documents.length} ADR:ää`}><Button size="sm" onClick={() => navigate("/project/adrs?create=adr")}>Luo ADR</Button></ConfigureToolbar>
        <div className="adr-content"><AdrLegend /><div className="grid gap-4">
          {!documents.length ? <p>Ei arkkitehtuuripäätöksiä. Luo ensimmäinen ADR.</p> : null}
          {[...documents].sort((a, b) => Number(a.id.slice(4)) - Number(b.id.slice(4))).map((document) => {
            const { value, error } = inspectAdr(document);
            return <article id={`card-${document.id}`} key={document.id} tabIndex={-1} className="adr-article" aria-label={document.id.toUpperCase()}><Card><CardContent className="p-5">
              <div className="mb-4 flex items-center justify-between gap-3"><h2 className="font-mono text-xs text-muted-foreground">{document.id.toUpperCase()}</h2><Button size="sm" variant="ghost" aria-label={`Muokkaa ${document.id.toUpperCase()}`} onClick={() => navigate(`/project/adrs?id=${document.id}`)}>Muokkaa</Button></div>
              {value ? <dl className="grid gap-4">{ADR_PARTS.map(({ key, label }) => <div className="adr-field" key={key}><dt><span className={`adr-field-label adr-${key}`}>{label}</span></dt><dd className="adr-prose"><mark className={`adr-${key}`}>{value[key]}</mark></dd></div>)}</dl> : <p role="alert" className="text-destructive">{error}</p>}
            </CardContent></Card></article>;
          })}
        </div></div></>}
  </div>;
}
