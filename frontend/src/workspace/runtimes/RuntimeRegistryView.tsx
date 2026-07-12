import { useEffect, useState } from "react";
import { FileText, RefreshCw, ServerCog } from "lucide-react";
import type { LocalRuntime } from "@shared/api/workspace-contracts";
import { Panel } from "@/components/shared/workspace-ui";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { toErrorMessage } from "@/lib/errors";
import { LocalRuntimeDetails } from "./LocalRuntimeDetails";
import { RuntimeLogsDialog } from "./RuntimeLogsDialog";
import { runtimeRegistryApi } from "./runtimeRegistryApi";

export function RuntimeRegistryView({ runtime, onRefreshed }: {
  runtime: LocalRuntime;
  onRefreshed: () => void | Promise<void>;
}) {
  const [current, setCurrent] = useState(runtime);
  const [refreshing, setRefreshing] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setCurrent(runtime), [runtime]);

  const refresh = async () => {
    setRefreshing(true);
    setError("");
    try {
      setCurrent(await runtimeRegistryApi.refresh());
      await onRefreshed();
    } catch (cause) {
      setError(toErrorMessage(cause, "Unable to refresh local CLI capabilities."));
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Panel
      title="Runtimes"
      titleExtra={<span className="font-mono text-[0.62rem] text-muted-foreground">Local · {current.hostname || "starting"}</span>}
      icon={<ServerCog />}
      contentClassName="p-0"
      action={(
        <div className="flex gap-1.5">
          <Button type="button" size="sm" variant="outline" onClick={() => setLogsOpen(true)}><FileText /> View logs</Button>
          <Button type="button" size="sm" variant="outline" disabled={refreshing} onClick={() => void refresh()}><RefreshCw className={refreshing ? "animate-spin" : ""} /> {refreshing ? "Refreshing…" : "Refresh capabilities"}</Button>
        </div>
      )}
    >
      {error ? <Alert variant="destructive" className="m-3"><AlertDescription>{error}</AlertDescription></Alert> : null}
      <LocalRuntimeDetails runtime={current} />
      <RuntimeLogsDialog open={logsOpen} onOpenChange={setLogsOpen} fallbackPath={current.logsPath} />
    </Panel>
  );
}
