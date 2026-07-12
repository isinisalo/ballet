import { TooltipProvider } from "@/components/ui/tooltip";
import { NotificationProvider } from "./app/notifications";
import { WorkspaceShell } from "./workspace/WorkspaceShell";

export function WorkspaceApp() {
  return (
    <TooltipProvider>
      <NotificationProvider>
        <WorkspaceShell />
      </NotificationProvider>
    </TooltipProvider>
  );
}
