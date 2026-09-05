import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useOrchestrationInvalidations } from "../useOrchestrationInvalidations";
import { StormDocumentStore } from "./StormDocumentStore";

export function useStormDocument(locked: boolean, onDirty: (value: boolean) => void) {
  const store = useMemo(() => new StormDocumentStore(), []);
  store.locked = locked;
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const refresh = useMemo(() => () => store.refresh(), [store]);
  useEffect(() => {
    store.activate(); refresh(); window.addEventListener("focus", refresh);
    return () => { store.dispose(); window.removeEventListener("focus", refresh); };
  }, [refresh, store]);
  useEffect(() => { onDirty(state.dirty); return () => onDirty(false); }, [onDirty, state.dirty]);
  useEffect(() => { if (!locked) void store.save(); }, [locked, store]);
  useOrchestrationInvalidations(refresh);
  return { store, ...state, refresh };
}
