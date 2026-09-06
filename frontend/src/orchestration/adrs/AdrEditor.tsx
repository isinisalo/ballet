import { useState } from "react";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { serializeAdr } from "@shared/orchestration/adr";
import type { ResourceDocument } from "../types";
import { ConfigureToolbar } from "../configure/ConfigureToolbar";
import { AdrFields, AdrLegend } from "./AdrFields";
import { adrEditorStatus } from "./adrPresentation";
import { useAdrDraft } from "./useAdrDraft";

export function AdrEditor({ current, initialId, unavailable = false, onDirty, onBack, onSave, onDelete }: {
  current?: ResourceDocument; initialId: string; unavailable?: boolean; onDirty?(dirty: boolean): void; onBack(): void;
  onSave(id: string, source: string, hash: string, creating: boolean): Promise<void>;
  onDelete(id: string, hash: string): Promise<void>;
}) {
  const editor = useAdrDraft(current, initialId, onDirty);
  const [confirming, setConfirming] = useState(false);
  const { draft, pending, stale, dirty, invalidSource } = editor;
  const disabled = pending || stale || Boolean(invalidSource) || unavailable;
  const status = adrEditorStatus({ unavailable, stale, pending, dirty, saved: Boolean(current) });
  const save = () => { if (!disabled && dirty && !editor.validation) void editor.execute((hash) => onSave(draft.id, serializeAdr(draft), hash, !current)); };
  return <>
    <ConfigureToolbar status={status}>
      <Button size="sm" variant="ghost" aria-label="Takaisin ADR-listaan" disabled={pending} onClick={onBack}><ArrowLeft aria-hidden="true" /></Button>
      <Button size="sm" variant="outline" disabled={pending} onClick={onBack}>Peruuta</Button>
      <Button size="sm" type="submit" form="adr-form" disabled={disabled || !dirty || Boolean(editor.validation)}>Tallenna ADR</Button>
    </ConfigureToolbar>
    <div className="adr-content"><AdrLegend />
      {unavailable ? <p role="alert" className="mb-4">ADR-tiedosto puuttuu. Luonnoksesi säilyy tässä näkymässä; tallennus on estetty.</p> : null}
      {stale ? <div role="alert" className="mb-4 break-all">Tiedosto muuttui. Muutoksesi säilyvät. Nykyinen hash: <code>{current?.contentHash ?? "absent"}</code><Button variant="outline" onClick={editor.reload}>Lataa nykyinen tiedosto</Button></div> : null}
      {invalidSource || editor.error ? <p role="alert" className="mb-4 text-destructive">{invalidSource || editor.error}</p> : null}
      <Card><CardContent className="p-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2"><span className="font-mono text-xs text-muted-foreground">{current ? draft.id.toUpperCase() : "UUSI ADR"}</span>
          {current ? <Button size="sm" variant="ghost" disabled={disabled} onClick={() => setConfirming(true)}><Trash2 aria-hidden="true" />Poista ADR</Button> : <span className="text-xs text-muted-foreground">Kaikki kentät ovat pakollisia</span>}
        </div>
        <form id="adr-form" onSubmit={(event) => { event.preventDefault(); save(); }}>
          <AdrFields draft={draft} setDraft={editor.setDraft} creating={!current} disabled={disabled} />
          {dirty && editor.validation ? <p role="alert" className="mt-3 text-sm text-destructive">{editor.validation}</p> : null}
        </form>
      </CardContent></Card>
    </div>
    <Dialog open={confirming} onOpenChange={(open) => { if (!pending) setConfirming(open); }}><DialogContent className="adr-dialog">
      <DialogHeader><DialogTitle>Poistetaanko {draft.id.toUpperCase()}?</DialogTitle><DialogDescription>ADR poistetaan projektista. Tallentamattomat muutokset hylätään. Viittaukset voivat estää poiston.</DialogDescription></DialogHeader>
      <DialogFooter><Button variant="outline" disabled={pending} onClick={() => setConfirming(false)}>Peruuta</Button><Button variant="destructive" disabled={disabled} onClick={() => { setConfirming(false); void editor.execute((hash) => onDelete(draft.id, hash)); }}>Poista ADR</Button></DialogFooter>
    </DialogContent></Dialog>
  </>;
}
