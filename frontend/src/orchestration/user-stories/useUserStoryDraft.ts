import { useEffect, useRef, useState } from "react";
import { ApiRequestError } from "@/apiClient";
import { toErrorMessage } from "@/lib/errors";
import type { UserStoryDocument, UserStoryInput } from "@shared/orchestration/userStories";
import { emptyStory, storyFieldErrors, storyInput } from "./userStoryPresentation";
import { userStoryApi } from "./userStoryApi";

export function useUserStoryDraft(current: UserStoryDocument | undefined, onDirty: (dirty: boolean) => void) {
  const [baseline, setBaseline] = useState(current);
  const [draft, setDraft] = useState<UserStoryInput>(() => current ? storyInput(current.value) : emptyStory());
  const [criterionKeys, setCriterionKeys] = useState(() => draft.acceptanceCriteria.map(() => crypto.randomUUID()));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [conflict, setConflict] = useState(false);
  const submitting = useRef(false);
  const active = useRef(true);
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline ? storyInput(baseline.value) : emptyStory());
  const errors = storyFieldErrors(draft);
  const valid = Object.keys(errors).length === 0;
  const stale = Boolean(baseline && current?.contentHash !== baseline.contentHash);
  useEffect(() => { onDirty(dirty); }, [dirty, onDirty]);
  useEffect(() => { active.current = true; return () => { active.current = false; onDirty(false); }; }, [onDirty]);
  const reset = () => {
    if (!current || (dirty && !window.confirm("Discard your edits and load the current file?"))) return;
    setBaseline(current); setDraft(storyInput(current.value));
    setCriterionKeys(current.value.acceptanceCriteria.map(() => crypto.randomUUID()));
    setError(undefined); setConflict(false);
  };
  const addCriterion = () => {
    setDraft((value) => ({ ...value, acceptanceCriteria: [...value.acceptanceCriteria, { given: "", when: "", then: "" }] }));
    const key = crypto.randomUUID(); setCriterionKeys((keys) => [...keys, key]);
    requestAnimationFrame(() => document.getElementById(`criterion-${key}-given`)?.focus());
  };
  const removeCriterion = (index: number) => {
    setDraft((value) => ({ ...value, acceptanceCriteria: value.acceptanceCriteria.filter((_, position) => position !== index) }));
    const nextKeys = criterionKeys.filter((_, position) => position !== index); setCriterionKeys(nextKeys);
    requestAnimationFrame(() => document.getElementById(nextKeys[index] ? `criterion-${nextKeys[index]}-given` : "add-criterion")?.focus());
  };
  const mutate = async (operation: () => Promise<void>) => {
    if (submitting.current) return;
    submitting.current = true; setPending(true); setError(undefined); setConflict(false);
    try { await operation(); }
    catch (reason) { if (active.current) { setError(toErrorMessage(reason, "Unable to save User Story.")); setConflict(reason instanceof ApiRequestError && reason.status === 409); } }
    finally { submitting.current = false; if (active.current) setPending(false); }
  };
  const save = (onSaved: (document: UserStoryDocument) => void) => mutate(async () => {
    if (!valid || stale) return;
    const document = await userStoryApi.save(draft, baseline);
    if (active.current) { onDirty(false); onSaved(document); }
  });
  const remove = (onRemoved: (id: string) => void) => mutate(async () => {
    if (!baseline || stale) return;
    await userStoryApi.remove(baseline);
    if (active.current) { onDirty(false); onRemoved(baseline.value.id); }
  });
  return { draft, setDraft, criterionKeys, dirty, valid, errors, pending, error, conflict, stale, baseline,
    reset, addCriterion, removeCriterion, save, remove };
}
