import { useEffect, useId, useRef, useState } from "react";
import type { ExecutionProfile, ExecutionProfileSaveRequest, LocalRuntime, RuntimeProvider } from "@shared/api/workspace-contracts";
import { toErrorMessage } from "@/lib/errors";
import { useRefreshSafeDraft } from "../useRefreshSafeDraft";
import { executionProfileBlockingReason, profileIdFromName, selectedProvider } from "./executionProfileOptions";

const emptyProfile = (): ExecutionProfile => ({
  id: "",
  name: "",
  provider: "" as RuntimeProvider,
  model: "",
  reasoningEffort: "",
  networkAccess: false
});

export function useExecutionProfileEditor({ profile, existingProfileIds, runtime, create, update: updateProfile, remove, onSaved, onDeleted }: {
  profile?: ExecutionProfile;
  existingProfileIds: readonly string[];
  runtime: LocalRuntime;
  create: (id: string, request: ExecutionProfileSaveRequest) => Promise<ExecutionProfile>;
  update: (id: string, request: ExecutionProfileSaveRequest) => Promise<ExecutionProfile>;
  remove: (id: string) => Promise<void>;
  onSaved?: (profile: ExecutionProfile) => void;
  onDeleted?: (id: string) => void;
}) {
  const formId = useId();
  const { draft, setDraft, accept, dirty } = useRefreshSafeDraft(profile ?? emptyProfile(), profile?.id ?? "new-execution-profile");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const operation = useRef(false);
  useEffect(() => setError(""), [profile?.id]);

  const update = (patch: Partial<ExecutionProfile>) => setDraft((current) => ({ ...current, ...patch }));
  const id = profile?.id ?? profileIdFromName(draft.name);
  const provider = selectedProvider(runtime, draft.provider);
  const nameError = draft.name.trim() ? undefined : "Name is required.";
  const idError = executionProfileIdError(profile, id, existingProfileIds);
  const providerError = draft.provider ? undefined : "Select a CLI provider.";
  const modelError = draft.model ? undefined : "Select a model.";
  const reasoningError = draft.reasoningEffort ? undefined : "Select a reasoning effort.";
  const availabilityError = !providerError && !modelError && !reasoningError
    ? executionProfileBlockingReason({ ...draft, id }, runtime)
    : undefined;
  const valid = !nameError && !idError && !providerError && !modelError && !reasoningError && !availabilityError;

  const selectProvider = (nextProvider: string) => update({
    provider: nextProvider as RuntimeProvider,
    model: "",
    reasoningEffort: ""
  });
  const selectModel = (model: string) => update({ model, reasoningEffort: "" });

  const submit = async () => {
    if (operation.current || !valid) return false;
    operation.current = true;
    setPending(true);
    setError("");
    const submittedDraft = draft;
    try {
      const request: ExecutionProfileSaveRequest = {
        name: draft.name.trim(),
        provider: draft.provider,
        model: draft.model,
        reasoningEffort: draft.reasoningEffort,
        networkAccess: draft.networkAccess
      };
      const saved = profile
        ? await updateProfile(profile.id, request)
        : await create(id, request);
      accept(saved, submittedDraft);
      onSaved?.(saved);
      return true;
    } catch (caught) {
      setError(toErrorMessage(caught, "Unable to save execution profile."));
      return false;
    } finally {
      operation.current = false;
      setPending(false);
    }
  };

  const deleteProfile = async () => {
    if (!profile || operation.current) return;
    operation.current = true;
    setPending(true);
    setError("");
    try {
      await remove(profile.id);
      onDeleted?.(profile.id);
    } catch (caught) {
      setError(toErrorMessage(caught, "Unable to delete execution profile."));
      throw caught;
    } finally {
      operation.current = false;
      setPending(false);
    }
  };

  return {
    formId, draft, id, provider, dirty, pending, valid, error,
    nameError, idError, providerError, modelError, reasoningError, availabilityError,
    update, selectProvider, selectModel, submit, deleteProfile
  };
}

export type ExecutionProfileEditorState = ReturnType<typeof useExecutionProfileEditor>;

const executionProfileIdError = (
  profile: ExecutionProfile | undefined,
  id: string,
  existingProfileIds: readonly string[]
): string | undefined => {
  if (!id) return "Name must contain letters or numbers so an ID can be generated.";
  if (!profile && existingProfileIds.includes(id)) return `An execution profile with ID ${id} already exists.`;
  return undefined;
};
