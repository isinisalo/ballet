import { useCallback, useRef, useState } from "react";
import { toErrorMessage } from "@/lib/errors";
import { ApiRequestError } from "@/apiClient";

export function useOrchestrationMutation(refresh: () => Promise<unknown>, onSuccess?: () => void) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const submitting = useRef(false);
  const execute = useCallback(async <T,>(operation: () => Promise<T>): Promise<T> => {
    if (submitting.current) throw new Error("An operation is already pending.");
    submitting.current = true;
    setPending(true); setError(undefined);
    try { const result = await operation(); await refresh(); onSuccess?.(); return result; }
    catch (reason) {
      if (reason instanceof ApiRequestError && reason.status === 409) {
        await refresh();
        setError(`${reason.message} The latest server state has been refreshed; review it before retrying.`);
      } else setError(toErrorMessage(reason, "Operation failed."));
      throw reason;
    }
    finally { submitting.current = false; setPending(false); }
  }, [onSuccess, refresh]);
  const run = useCallback(async (operation: () => Promise<unknown>) => {
    try { await execute(operation); return true; } catch { return false; }
  }, [execute]);
  return { run, execute, pending, error, clearError: () => setError(undefined) };
}
