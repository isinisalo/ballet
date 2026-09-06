import { parseAdr, type AdrRecord } from "@shared/orchestration/adr";
import type { ResourceDocument } from "../types";

export const ADR_PARTS = [
  { key: "title", label: "Otsikko", placeholder: "Päätöksen lyhyt nimi" },
  { key: "decision", label: "Päätös", placeholder: "Mitä on päätetty?" },
  { key: "scope", label: "Soveltamisala", placeholder: "Missä päätöstä sovelletaan?" }
] as const;
export function inspectAdr(document: ResourceDocument): { value?: AdrRecord; error?: string } {
  try { return { value: parseAdr(document.content, document.id) }; }
  catch (reason) { return { error: reason instanceof Error ? reason.message : "Virheellinen ADR." }; }
}

export function adrEditorStatus(state: { unavailable: boolean; stale: boolean; pending: boolean; dirty: boolean; saved: boolean }): string {
  if (state.unavailable) return "Tiedosto puuttuu";
  if (state.stale) return "Tiedosto muuttunut";
  if (state.pending) return "Tallennetaan…";
  if (state.dirty) return "Tallentamatta";
  return state.saved ? "Tallennettu" : "Uusi";
}
