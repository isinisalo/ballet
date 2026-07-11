import { useCallback, useEffect, useState } from "react";
import { toErrorMessage } from "@/lib/errors";
import { runtimeRegistryApi } from "./runtimeRegistryApi";
import type { PairingSession } from "./types";

export function usePairingSession(open: boolean, initialPairingId?: string) {
  const [session, setSession] = useState<PairingSession | null>(null);
  const [pending, setPending] = useState<"create" | "approve" | "poll" | null>(null);
  const [error, setError] = useState("");

  const create = useCallback(async () => {
    setPending("create");
    setError("");
    try {
      setSession(await runtimeRegistryApi.createPairingSession());
    } catch (caught) {
      setError(toErrorMessage(caught, "Unable to create a pairing session."));
    } finally {
      setPending(null);
    }
  }, []);

  const approve = useCallback(async () => {
    if (!session) return;
    setPending("approve");
    setError("");
    try {
      setSession(await runtimeRegistryApi.approvePairingSession(session.id));
    } catch (caught) {
      setError(toErrorMessage(caught, "Unable to approve this computer."));
    } finally {
      setPending(null);
    }
  }, [session]);

  const refresh = useCallback(async () => {
    if (!session) return;
    setPending((current) => current ?? "poll");
    try {
      setSession(await runtimeRegistryApi.getPairingSession(session.id));
      setError("");
    } catch (caught) {
      setError(toErrorMessage(caught, "Pairing status is unavailable."));
    } finally {
      setPending((current) => current === "poll" ? null : current);
    }
  }, [session]);

  useEffect(() => {
    if (!open || !initialPairingId || session) return;
    setPending("poll");
    void runtimeRegistryApi.getPairingSession(initialPairingId)
      .then((value) => { setSession(value); setError(""); })
      .catch((caught) => setError(toErrorMessage(caught, "Unable to load this pairing session.")))
      .finally(() => setPending(null));
  }, [initialPairingId, open, session]);

  useEffect(() => {
    const waitingForReadiness = session?.status === "claimed"
      && (!session.claimedDevice || session.claimedDevice.status !== "online" || session.claimedDevice.backends.length === 0);
    if (!open || !session || (!["pending", "approved"].includes(session.status) && !waitingForReadiness)) return;
    const timer = window.setInterval(() => void refresh(), 2000);
    return () => window.clearInterval(timer);
  }, [open, refresh, session]);

  const reset = useCallback(() => {
    setSession(null);
    setPending(null);
    setError("");
  }, []);

  return { session, pending, error, create, approve, refresh, reset };
}
