import type { AppData } from "../../shared/api/workspaceData.js";
import { loadMarkdownAppData } from "../markdown-adapter.js";
import {
  automationPoliciesToEventDefinitions,
  automationPoliciesToPolicies,
  automationRuntimesToRuntimes,
  loadProjectAutomationConfigWithIssues
} from "../automation.js";
import type { RuntimeDatabaseProvider } from "./RuntimeDatabaseProvider.js";

export class WorkspaceDataService {
  constructor(
    private readonly root: () => string,
    private readonly runtimeDatabaseProvider: RuntimeDatabaseProvider
  ) {}

  async read(): Promise<AppData> {
    const data = await loadMarkdownAppData(this.root());
    const automation = await loadProjectAutomationConfigWithIssues(this.root(), data.agents);
    data.automation = automation.config;
    data.automationIssues = automation.issues;
    data.eventDefinitions = automationPoliciesToEventDefinitions(automation.config.policies, automation.config.triggers, automation.config.actions, automation.config.outputs);
    data.policies = automationPoliciesToPolicies(automation.config.policies, automation.config.actions);
    data.runtimes = automationRuntimesToRuntimes(automation.config.runtimes);
    data.events = this.runtimeDatabaseProvider.runtimeDatabase().listEventRecords();
    data.agentRuns = this.runtimeDatabaseProvider.runtimeDatabase().listRuns();
    return data;
  }
}
