import { useCallback, useEffect, useState } from "react";
import type { AppData } from "../../../../shared/api/workspace-contracts";
import { api } from "../../api";
import { toErrorMessage } from "@/lib/errors";
import { emptyData } from "../types";

type Notify = (input: { type: "info" | "error"; message: string }) => string;

export function useWorkspaceData({ notify }: { notify: Notify }) {
  const [data, setData] = useState<AppData>(emptyData);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await api.getData();
      setData(next);
    } catch (err) {
      notify({ type: "error", message: toErrorMessage(err, "Failed to load data.") });
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    data,
    loading,
    refresh
  };
}
