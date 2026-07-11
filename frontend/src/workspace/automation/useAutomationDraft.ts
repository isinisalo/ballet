import { useEffect, useRef, useState } from "react";
import type { ProjectAutomationConfig } from "@shared/api/workspace-contracts";

export type AutomationConfigUpdater = (updater: (config: ProjectAutomationConfig) => ProjectAutomationConfig) => void;

export function useAutomationDraft({
  automation,
  saveAutomation
}: {
  automation: ProjectAutomationConfig;
  saveAutomation: (config: ProjectAutomationConfig) => Promise<ProjectAutomationConfig>;
}) {
  const [draft, setDraft] = useState<ProjectAutomationConfig>(() => automation);
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
    const saved = await saveAutomation(nextDraft);
    receivedFingerprintRef.current = JSON.stringify(saved);
    setDraft(saved);
    return true;
  };

  return {
    draft,
    setDraft,
    updateConfig,
    saveDraft,
    isDirty: JSON.stringify(draft) !== receivedFingerprintRef.current
  };
}
