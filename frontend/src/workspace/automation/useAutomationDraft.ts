import { useEffect, useRef, useState } from "react";
import type { ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { toErrorMessage } from "@/lib/errors";

export type AutomationConfigUpdater = (updater: (config: ProjectAutomationConfig) => ProjectAutomationConfig) => void;

export function useAutomationDraft({
  automation,
  saveAutomation
}: {
  automation: ProjectAutomationConfig;
  saveAutomation: (config: ProjectAutomationConfig) => Promise<ProjectAutomationConfig>;
}) {
  const [draft, setDraft] = useState<ProjectAutomationConfig>(() => automation);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const savingRef = useRef(false);
  const receivedFingerprintRef = useRef(JSON.stringify(automation));

  useEffect(() => {
    const nextFingerprint = JSON.stringify(automation);
    const previousFingerprint = receivedFingerprintRef.current;
    receivedFingerprintRef.current = nextFingerprint;
    setDraft((current) => {
      const currentFingerprint = JSON.stringify(current);
      return currentFingerprint === previousFingerprint ? automation : current;
    });
  }, [automation]);

  const updateConfig: AutomationConfigUpdater = (updater) => {
    setDraft((current) => updater(current));
  };

  const saveDraft = async (nextDraft: ProjectAutomationConfig = draft) => {
    if (savingRef.current) return false;
    const submittedFingerprint = JSON.stringify(nextDraft);
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      const saved = await saveAutomation(nextDraft);
      receivedFingerprintRef.current = JSON.stringify(saved);
      setDraft((current) => JSON.stringify(current) === submittedFingerprint ? saved : current);
      return true;
    } catch (cause) {
      setError(toErrorMessage(cause, "Unable to save Loop changes."));
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return {
    draft,
    setDraft,
    updateConfig,
    saveDraft,
    isDirty: JSON.stringify(draft) !== receivedFingerprintRef.current,
    saving,
    error
  };
}
