import type { ProjectAutomationConfig } from "../../shared/domain/automation.js";
import { loadMarkdownAppData } from "../markdown-adapter.js";
import { saveProjectAutomationConfig } from "../automation.js";
import { notifyRuntimeChanged } from "../runtime-events.js";

export class AutomationService {
  constructor(private readonly root: () => string) {}

  async save(config: ProjectAutomationConfig): Promise<ProjectAutomationConfig> {
    const data = await loadMarkdownAppData(this.root());
    const saved = await saveProjectAutomationConfig(this.root(), config, data.agents);
    notifyRuntimeChanged("events");
    return saved;
  }
}
