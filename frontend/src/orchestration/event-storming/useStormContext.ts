import { useCallback, useEffect, useState } from "react";
import type { StormContext } from "@shared/orchestration/eventStormingContext";
import { useOrchestrationInvalidations } from "../useOrchestrationInvalidations";
import { stormApi } from "./stormApi";
export function useStormContext(process?: string, story?: string) {
  const [data, setData] = useState<StormContext>(); const [error, setError] = useState<string>();
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(async () => { setRevision((v) => v + 1); }, []);
  useEffect(() => {
    let active = true; setData(undefined); setError(undefined);
    stormApi.context({ process, story }).then((v) => { if (active) setData(v); }).catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : String(e)); });
    return () => { active = false; };
  }, [process, story, revision]);
  useEffect(() => { window.addEventListener("focus", refresh); return () => window.removeEventListener("focus", refresh); }, [refresh]);
  useOrchestrationInvalidations(refresh);
  return { data, error, refresh };
}
