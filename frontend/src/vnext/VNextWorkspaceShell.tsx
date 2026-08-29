import { Alert, AlertDescription } from "@/components/ui/alert";
import type { RouteState } from "@/workspace/types";
import type { WorkspaceNavigation } from "@/workspace/useWorkspaceNavigation";
import { VNextConfigureOutlet } from "./configure/VNextConfigureOutlet";
import { VNextFrame } from "./VNextFrame";
import { VNextSidebar } from "./VNextSidebar";
import { useVNextConfigureData } from "./useVNextConfigureData";
import { useVNextInvalidations } from "./useVNextInvalidations";
import { useVNextMutation } from "./useVNextMutation";
import { useCallback, useEffect, useState } from "react";

export function VNextWorkspaceShell({ route, navigate, setNavigationBlocker }: { route: RouteState; navigate: WorkspaceNavigation["navigate"]; setNavigationBlocker: WorkspaceNavigation["setNavigationBlocker"] }) {
  const [dirty, setDirty] = useState(false);
  const { data, loading, error, refresh } = useVNextConfigureData();
  useVNextInvalidations(refresh);
  const clearDirty = useCallback(() => setDirty(false), []);
  const mutation = useVNextMutation(refresh, clearDirty);
  useEffect(() => { setNavigationBlocker({ isDirty: dirty, message: "Discard unsaved vNext changes?" }); return () => setNavigationBlocker(null); }, [dirty, setNavigationBlocker]);
  let content = <Alert className="m-4"><AlertDescription>Loading isolated vNext workspace…</AlertDescription></Alert>;
  if (error) content = <Alert variant="destructive" className="m-4"><AlertDescription>{error}</AlertDescription></Alert>;
  else if (!loading && data) content = <div onInput={() => setDirty(true)}><VNextConfigureOutlet route={route} data={data} navigate={navigate} mutation={mutation} /></div>;
  return <VNextFrame sidebar={<VNextSidebar route={route} navigate={navigate} />}>{content}</VNextFrame>;
}
