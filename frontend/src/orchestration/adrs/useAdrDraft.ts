import { useEffect, useRef, useState } from "react";
import { serializeAdr, type AdrRecord } from "@shared/orchestration/adr";
import type { ResourceDocument } from "../types";
import { inspectAdr } from "./adrPresentation";

export function useAdrDraft(current: ResourceDocument | undefined, initialId: string, onDirty?: (dirty: boolean) => void) {
  const empty = (): AdrRecord => ({ id: initialId, title: "", decision: "", scope: "" });
  const [baseline, setBaseline] = useState(current);
  const [draft, setDraft] = useState(() => current ? inspectAdr(current).value ?? empty() : empty());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const original = baseline ? inspectAdr(baseline).value : empty();
  const dirty = JSON.stringify(draft) !== JSON.stringify(original);
  const stale = current?.contentHash !== baseline?.contentHash;
  let validation = "";
  try { serializeAdr(draft); } catch (reason) { validation = (reason as Error).message; }
  const invalidSource = current ? inspectAdr(current).error : undefined;
  useEffect(() => { onDirty?.(dirty); return () => onDirty?.(false); }, [dirty, onDirty]);
  const reload = () => {
    if (dirty && !window.confirm("Hylätäänkö muutokset ja ladataanko nykyinen tiedosto?")) return;
    setBaseline(current); setDraft(current ? inspectAdr(current).value ?? empty() : empty()); setError("");
  };
  const execute = async (operation: (hash: string) => Promise<void>) => {
    if (submitting.current || stale || invalidSource) return;
    submitting.current = true; setPending(true); setError("");
    try { await operation(baseline?.contentHash ?? "absent"); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Tallennus epäonnistui."); }
    finally { submitting.current = false; setPending(false); }
  };
  return { draft, setDraft, dirty, stale, pending, error, validation, invalidSource, reload, execute };
}
