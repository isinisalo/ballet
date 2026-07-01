import type { ProjectAutomationIssue } from "../../../../shared/api/workspace-contracts";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function AutomationIssues({ issues }: { issues: ProjectAutomationIssue[] }) {
  if (issues.length === 0) return null;
  return (
    <Alert variant="destructive">
      <AlertDescription>
        {issues.map((issue) => `${issue.path}: ${issue.message}`).join(" ")}
      </AlertDescription>
    </Alert>
  );
}
