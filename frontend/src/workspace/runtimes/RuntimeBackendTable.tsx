import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { backendReadiness, formatRuntimeTimestamp, providerLabel } from "./runtimeRegistry";
import type { RuntimeDevice } from "./types";

const toneClass = {
  healthy: "border-secondary/30 bg-secondary/10 text-secondary",
  warning: "border-tertiary/30 bg-tertiary/10 text-tertiary",
  error: "border-destructive/30 bg-destructive/10 text-destructive",
  muted: "text-muted-foreground"
};

export function RuntimeBackendTable({ device }: { device: RuntimeDevice }) {
  return (
    <div className="overflow-x-auto border-t border-divider-strong">
      <Table>
        <TableHeader>
          <TableRow className="bg-panel-section">
            <TableHead>CLI runtime</TableHead>
            <TableHead>Version</TableHead>
            <TableHead>Authentication</TableHead>
            <TableHead>Health</TableHead>
            <TableHead>Model capability</TableHead>
            <TableHead>Agents</TableHead>
            <TableHead>Active runs</TableHead>
            <TableHead>Last seen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {device.backends.map((backend) => {
            const readiness = backendReadiness(device, backend);
            return (
              <TableRow key={backend.id}>
                <TableCell>
                  <span className="block font-medium">{providerLabel(backend.provider)}</span>
                  <span className="block font-mono text-[0.62rem] text-muted-foreground">{backend.executablePath ?? "Not reported"}</span>
                </TableCell>
                <TableCell className="font-mono text-xs">{backend.cliVersion ?? "—"}</TableCell>
                <TableCell>
                  <span className="font-mono text-[0.65rem]">{backend.authStatus}</span>
                  {backend.authStatus !== "ready" ? <code className="mt-1 block whitespace-nowrap text-[0.62rem] text-tertiary">Run locally: {backend.provider === "codex" ? "codex login" : "copilot login"}</code> : null}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn("font-mono text-[0.62rem]", toneClass[readiness.tone])}>
                    {readiness.label}
                  </Badge>
                  {backend.healthMessage ? <span className="mt-1 block max-w-64 whitespace-normal text-[0.65rem] text-muted-foreground">{backend.healthMessage}</span> : null}
                </TableCell>
                <TableCell className="max-w-64 whitespace-normal font-mono text-[0.65rem] text-muted-foreground">{backend.capabilities.models.length > 0 ? backend.capabilities.models.map((model) => `${model.label}${model.reasoningOptions.length ? ` (${model.reasoningOptions.join("/")})` : ""}`).join(" · ") : "No models reported"}</TableCell>
                <TableCell className="font-mono text-xs">{backend.assignedAgentCount}</TableCell>
                <TableCell className="font-mono text-xs">{backend.activeRunCount}</TableCell>
                <TableCell className="font-mono text-[0.68rem] text-muted-foreground">{formatRuntimeTimestamp(backend.updatedAt)}</TableCell>
              </TableRow>
            );
          })}
          {device.backends.length === 0 ? (
            <TableRow><TableCell colSpan={8} className="text-muted-foreground">No supported CLI runtimes detected.</TableCell></TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}
