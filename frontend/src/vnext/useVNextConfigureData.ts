import { useCallback, useEffect, useRef, useState } from "react";
import { toErrorMessage } from "@/lib/errors";
import { vNextApi } from "./vNextApi";
import type { VNextConfigureData } from "./types";

export function useVNextConfigureData() {
  const [data, setData] = useState<VNextConfigureData>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    const requestSequence = ++sequence.current;
    try {
      const [project, references, instructions, skills, goals, adrs, constraints, useCases, schedules] = await Promise.all([
        vNextApi.project(), vNextApi.references(), vNextApi.resources("instructions"),
        vNextApi.resources("skills"), vNextApi.resources("goals"), vNextApi.resources("adrs"),
        vNextApi.resources("constraints"), vNextApi.resources("use-cases"), vNextApi.schedules()
      ]);
      if (requestSequence !== sequence.current) return;
      setData({ project, references, instructions, skills, goals, adrs, constraints, useCases, schedules }); setError(undefined);
    } catch (reason) {
      if (requestSequence === sequence.current) setError(toErrorMessage(reason, "Unable to load vNext workspace."));
    } finally { if (requestSequence === sequence.current) setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  return { data, loading, error, refresh };
}
