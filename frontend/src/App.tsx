import { lazy, Suspense } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const WorkspaceApp = lazy(() => import("./WorkspaceApp").then((module) => ({ default: module.WorkspaceApp })));

export function App() {
  return (
    <Suspense fallback={<Alert><AlertDescription>Loading workspace shell...</AlertDescription></Alert>}>
      <WorkspaceApp />
    </Suspense>
  );
}
