import { Palette, Route } from "lucide-react";
import type { AppData, ProjectAutomationConfig, ProjectAutomationIssue } from "@shared/api/workspace-contracts";
import { Panel } from "@/components/shared/workspace-ui";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { AutomationLoopView } from "../types";
import { automationAllLoopsPath, automationLoopPath, automationThemePath } from "../routing";
import { AutomationEditorWorkspace, AutomationIssueBanner } from "./AutomationEditorWorkspace";
import { useAutomationDraft } from "./useAutomationDraft";
import { AllLoopsCanvas } from "./loops/AllLoopsCanvas";
import { removeLoopAtIndex } from "./loops/loopEditorState";
import { isActiveLoopRun } from "./loops/loopRunState";
import type { WorkspaceNavigation } from "../useWorkspaceNavigation";

export function AutomationView({ data, selectedId, loopView, saveAutomation, navigate, setNavigationBlocker: _setNavigationBlocker }: {
  data: AppData;
  selectedId?: string;
  loopView?: AutomationLoopView;
  saveAutomation: (config: ProjectAutomationConfig) => Promise<ProjectAutomationConfig>;
  navigate: WorkspaceNavigation["navigate"];
  setNavigationBlocker: WorkspaceNavigation["setNavigationBlocker"];
}) {
  void _setNavigationBlocker;
  const { draft, saveDraft, saving, error } = useAutomationDraft({ automation: data.automation, saveAutomation });
  const selectedLoop = draft.loops.find((loop) => loop.id === selectedId);
  const issues = [...data.automationIssues, ...data.loopThemeIssues];
  const lockedLoopIds = new Set(data.loopRuns.filter((run) => isActiveLoopRun(run)).map((run) => run.loopId));
  const removeLoop = async (loopId: string) => {
    if (lockedLoopIds.has(loopId)) return;
    const index = draft.loops.findIndex((loop) => loop.id === loopId);
    if (index < 0 || !await saveDraft(removeLoopAtIndex(draft, index))) return;
    navigate(automationAllLoopsPath(), { bypassBlocker: true });
  };

  if (loopView === "all") return (
    <AutomationOverview
      draft={draft}
      issues={issues}
      error={error}
      saving={saving}
      lockedLoopIds={lockedLoopIds}
      navigate={navigate}
      onDeleteLoop={removeLoop}
    />
  );

  return <AutomationEditorWorkspace data={data} draft={draft} displayedLoop={selectedLoop} issues={issues} />;
}

function AutomationOverview({ draft, issues, error, saving, lockedLoopIds, navigate, onDeleteLoop }: {
  draft: ProjectAutomationConfig;
  issues: ProjectAutomationIssue[];
  error: string;
  saving: boolean;
  lockedLoopIds: ReadonlySet<string>;
  navigate: WorkspaceNavigation["navigate"];
  onDeleteLoop: (loopId: string) => unknown | Promise<unknown>;
}) {
  return (
    <Panel title="Automation" icon={<Route />} contentClassName="p-0" action={(
      <Button size="sm" variant="outline" onClick={() => navigate(automationThemePath())}>
        <Palette /> Edit theme
      </Button>
    )}>
      <AutomationIssueBanner issues={issues} />
      {error ? <Alert variant="destructive" className="m-4 mb-0"><AlertDescription>{error}</AlertDescription></Alert> : null}
      <AllLoopsCanvas
        config={draft}
        disabled={saving}
        lockedLoopIds={lockedLoopIds}
        onAddLoop={() => navigate(automationLoopPath())}
        onOpenLoop={(id) => navigate(automationLoopPath(id))}
        onDeleteLoop={onDeleteLoop}
      />
    </Panel>
  );
}
