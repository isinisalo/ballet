import { TooltipProvider } from "@/components/ui/tooltip";
import { NotificationProvider } from "./app/notifications";
import { AdminGate } from "./app/admin/AdminGate";
import { WorkspaceShell } from "./workspace/WorkspaceShell";

export function WorkspaceApp() {
  return (
    <TooltipProvider>
      <NotificationProvider>
        <AdminGate><WorkspaceShell /></AdminGate>
      </NotificationProvider>
    </TooltipProvider>
  );
}
