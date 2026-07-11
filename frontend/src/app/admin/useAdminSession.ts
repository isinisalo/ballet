import { useCallback, useEffect, useState } from "react";
import { request, setCsrfToken } from "@/apiClient";
import { toErrorMessage } from "@/lib/errors";

export interface AdminStatus {
  bootstrapped: boolean;
  authenticated: boolean;
  csrfToken?: string;
}

export function useAdminSession() {
  const [status, setStatus] = useState<AdminStatus>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next = await request<AdminStatus>("/api/admin/status");
      setCsrfToken(next.csrfToken);
      setStatus(next);
    } catch (cause) {
      setError(toErrorMessage(cause, "Unable to read admin session."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const authenticate = async (password: string) => {
    setSubmitting(true);
    setError("");
    try {
      await request(status?.bootstrapped ? "/api/admin/login" : "/api/admin/bootstrap", {
        method: "POST",
        body: JSON.stringify({ password })
      });
      await refresh();
    } catch (cause) {
      setError(toErrorMessage(cause, "Authentication failed."));
    } finally {
      setSubmitting(false);
    }
  };

  return { status, loading, submitting, error, authenticate, refresh };
}
