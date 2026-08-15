import type { ReactNode } from "react";
import type { AppData, ProjectAutomationConfig, ProjectAutomationIssue, ProjectLoop } from "@shared/api/workspace-contracts";
import { EmptyState } from "@/components/shared/workspace-ui";
import { AutomationIssues } from "./AutomationIssues";
import { LoopEditor } from "./loops/LoopEditor";

export function AutomationEditorWorkspace({ data, draft, displayedLoop, issues }: {
  data: AppData;
  draft: ProjectAutomationConfig;
  displayedLoop?: ProjectLoop;
  issues: ProjectAutomationIssue[];
}) {
  return (
    <>
      <AutomationIssueBanner issues={issues} />
      {!displayedLoop ? <div className="p-4"><EmptyState title="Loop not found." /></div> : null}
      {displayedLoop ? (
        <LoopEditor
          config={draft}
          loop={displayedLoop}
          executionProfiles={data.executionProfiles}
          runtime={data.runtime}
          theme={data.loopTheme}
        />
      ) : null}
    </>
  );
}

export function AutomationIssueBanner({ issues }: { issues: ProjectAutomationIssue[] }): ReactNode {
  return issues.length
    ? <div className="border-b border-divider-strong p-4"><AutomationIssues issues={issues} /></div>
    : null;
}
