import { useEffect, useState } from "react";
import type { ProjectAutomationConfig } from "../../../../shared/api/workspace-contracts";
import { ensureAutomationConfig } from "./automationConfigCompat";

export type AutomationConfigUpdater = (updater: (config: ProjectAutomationConfig) => ProjectAutomationConfig) => void;

export function useAutomationDraft({
  automation,
  saveAutomation
}: {
  automation?: ProjectAutomationConfig;
  saveAutomation: (config: ProjectAutomationConfig) => Promise<ProjectAutomationConfig>;
}) {
  const [draft, setDraft] = useState<ProjectAutomationConfig>(() => ensureAutomationConfig(automation));

  useEffect(() => {
    setDraft(ensureAutomationConfig(automation));
  }, [automation]);

  const updateConfig: AutomationConfigUpdater = (updater) => {
    setDraft((current) => updater(current));
  };

  const saveDraft = async (nextDraft: ProjectAutomationConfig = draft) => {
    const saved = await saveAutomation(nextDraft);
    setDraft(saved);
    return true;
  };

  return {
    draft,
    setDraft,
    updateConfig,
    saveDraft
  };
}
