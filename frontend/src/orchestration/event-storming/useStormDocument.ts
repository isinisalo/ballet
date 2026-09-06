import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useOrchestrationInvalidations } from "../useOrchestrationInvalidations";
import { StormDocumentStore } from "./StormDocumentStore";
export function useStormDocument(locked: boolean, onDirty: (value: boolean) => void) {
  const store = useMemo(() => new StormDocumentStore(), []);
  store.locked = locked;
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  useEffect(() => {
    store.activate(); void store.refresh(); window.addEventListener("focus", store.refresh);
    return () => { store.dispose(); window.removeEventListener("focus", store.refresh); };
  }, [store]);
  const dirty = state.model.dirty || state.layout.dirty;
  useEffect(() => { onDirty(dirty); return () => onDirty(false); }, [onDirty, dirty]);
  useEffect(() => { if (!locked) void store.save(); }, [locked, store]);
  useOrchestrationInvalidations(store.refresh);
  return { store, ...state };
}
