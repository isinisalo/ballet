import { useCallback, useEffect, useRef, useState } from "react";
import { toErrorMessage } from "@/lib/errors";
import type { UserStoryCollection, UserStoryDocument } from "@shared/orchestration/userStories";
import { useOrchestrationInvalidations } from "../useOrchestrationInvalidations";
import { userStoryApi } from "./userStoryApi";

export function useUserStories() {
  const [data, setData] = useState<UserStoryCollection>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++sequence.current;
    try {
      const next = await userStoryApi.list();
      if (current === sequence.current) { setData(next); setError(undefined); }
    } catch (reason) {
      if (current === sequence.current) setError(toErrorMessage(reason, "Unable to load User Stories."));
    } finally { if (current === sequence.current) setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); return () => { sequence.current++; }; }, [refresh]);
  useEffect(() => {
    const onFocus = () => { void refresh(); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);
  useOrchestrationInvalidations(refresh);
  const acceptSaved = (document: UserStoryDocument) => {
    sequence.current++;
    setData((current) => ({ issues: current?.issues ?? [], stories: [
      ...(current?.stories ?? []).filter(({ value }) => value.id !== document.value.id), document
    ].sort((left, right) => left.value.id.localeCompare(right.value.id)) }));
    setError(undefined);
  };
  const acceptRemoved = (id: string) => {
    sequence.current++;
    setData((current) => ({ issues: current?.issues ?? [], stories: (current?.stories ?? []).filter(({ value }) => value.id !== id) }));
    setError(undefined);
  };
  return { data, error, loading, refresh, acceptSaved, acceptRemoved };
}
