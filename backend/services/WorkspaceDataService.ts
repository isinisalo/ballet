import type { AppData } from "../../shared/api/workspaceData.js";
import { loadMarkdownAppData } from "../markdown-adapter.js";
import { loadProjectAutomationConfigWithIssues } from "../automation.js";
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
    data.eventDefinitions = [];
    data.events = this.runtimeDatabaseProvider.runtimeDatabase().listEventRecords();
    data.loopRuns = this.runtimeDatabaseProvider.runtimeDatabase().listLoopRuns();
    return data;
  }
}
