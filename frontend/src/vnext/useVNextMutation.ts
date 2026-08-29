import { useCallback, useState } from "react";
import { toErrorMessage } from "@/lib/errors";

export function useVNextMutation(refresh: () => Promise<unknown>, onSuccess?: () => void) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const run = useCallback(async (operation: () => Promise<unknown>) => {
    if (pending) return false;
    setPending(true); setError(undefined);
    try { await operation(); await refresh(); onSuccess?.(); return true; }
    catch (reason) { setError(toErrorMessage(reason, "Operation failed.")); return false; }
    finally { setPending(false); }
  }, [onSuccess, pending, refresh]);
  return { run, pending, error, clearError: () => setError(undefined) };
}
