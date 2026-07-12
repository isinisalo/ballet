import { useCallback, useEffect, useRef, useState } from "react";
import type { AppData } from "../../../../shared/api/workspace-contracts";
import { api } from "../../api";
import { toErrorMessage } from "@/lib/errors";
import { emptyData } from "../types";

type Notify = (input: { type: "info" | "error"; message: string }) => string;

export function useWorkspaceData({ notify }: { notify: Notify }) {
  const [data, setData] = useState<AppData>(emptyData);
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true);
    try {
      const next = await api.getData();
      if (generation.current === current) setData(next);
    } catch (err) {
      if (generation.current === current) notify({ type: "error", message: toErrorMessage(err, "Failed to load data.") });
    } finally {
      if (generation.current === current) setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void refresh();
    return () => { generation.current += 1; };
  }, [refresh]);

  return {
    data,
    loading,
    refresh
  };
}
