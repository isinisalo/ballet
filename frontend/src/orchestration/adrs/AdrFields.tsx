import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AdrRecord } from "@shared/orchestration/adr";
import { ADR_PARTS } from "./adrPresentation";

export function AdrLegend() {
  return <ul className="adr-legend" aria-label="ADR-kenttien väriselite">{ADR_PARTS.map(({ key, label }) => <li key={key}><span aria-hidden="true" className={`adr-swatch adr-${key}`} />{label}</li>)}</ul>;
}
export function AdrFields({ draft, setDraft, creating, disabled }: {
  draft: AdrRecord; setDraft(value: AdrRecord): void; creating: boolean; disabled: boolean;
}) {
  return <fieldset disabled={disabled} className="min-w-0 space-y-5"><legend className="sr-only">Arkkitehtuuripäätös</legend>
    <div className="grid max-w-48 gap-2"><Label htmlFor="adr-id">Tunniste</Label><Input id="adr-id" value={draft.id} readOnly={!creating} required pattern="adr-[0-9]{3,}" onChange={(event) => setDraft({ ...draft, id: event.target.value })} /></div>
    {ADR_PARTS.map(({ key, label, placeholder }) => <div className="adr-field" key={key}>
      <Label htmlFor={`adr-${key}`}><span className={`adr-field-label adr-${key}`}>{label}</span></Label>
      <Textarea id={`adr-${key}`} className={`adr-${key}`} required rows={2} placeholder={placeholder} value={draft[key]}
        onChange={(event) => setDraft({ ...draft, [key]: event.target.value.replace(/[\r\n]+/g, " ") })} />
    </div>)}
  </fieldset>;
}
