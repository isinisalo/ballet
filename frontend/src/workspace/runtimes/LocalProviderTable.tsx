import type { LocalProviderStatus } from "@shared/api/workspace-contracts";
import { OperationalStatus, type OperationalStatusTone } from "@/components/shared/workspace-ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { providerLabel, providerReadiness } from "./runtimeRegistry";

const statusTone: Record<ReturnType<typeof providerReadiness>["tone"], OperationalStatusTone> = {
  healthy: "healthy",
  warning: "attention",
  error: "danger",
  muted: "neutral"
};

export function LocalProviderTable({ providers }: { providers: LocalProviderStatus[] }) {
  return (
    <div className="overflow-x-auto border-t border-divider-strong">
      <Table>
        <TableHeader>
          <TableRow className="bg-panel-section">
            <TableHead>CLI provider</TableHead>
            <TableHead>Version</TableHead>
            <TableHead>Authentication</TableHead>
            <TableHead>Health</TableHead>
            <TableHead>Model capability</TableHead>
            <TableHead>Policy</TableHead>
            <TableHead>Active runs</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {providers.map((provider) => <ProviderRow key={provider.provider} provider={provider} />)}
          {providers.length === 0 ? <TableRow><TableCell colSpan={7} className="text-muted-foreground">CLI capability probing has not completed.</TableCell></TableRow> : null}
        </TableBody>
      </Table>
    </div>
  );
}

function ProviderRow({ provider }: { provider: LocalProviderStatus }) {
  const readiness = providerReadiness(provider);
  const repairCommand = provider.provider === "codex" ? "codex login" : "copilot login";
  const policy = provider.capabilities.policy;
  return (
    <TableRow>
      <TableCell><span className="block font-medium">{providerLabel(provider.provider)}</span><span className="block font-mono text-[0.62rem] text-muted-foreground">{provider.command}</span></TableCell>
      <TableCell className="font-mono text-xs">{provider.cliVersion ?? "—"}</TableCell>
      <TableCell><span className="font-mono text-[0.65rem]">{provider.authStatus}</span>{provider.authStatus !== "ready" ? <code className="mt-1 block whitespace-nowrap text-[0.62rem] text-tertiary">Run locally: {repairCommand}</code> : null}</TableCell>
      <TableCell><OperationalStatus compact label={readiness.label} tone={statusTone[readiness.tone]} />{provider.healthMessage ? <span className="mt-1 block max-w-64 whitespace-normal text-[0.65rem] text-muted-foreground">{provider.healthMessage}</span> : null}</TableCell>
      <TableCell className="max-w-72 whitespace-normal font-mono text-[0.65rem] text-muted-foreground">{provider.capabilities.models.length ? provider.capabilities.models.map((model) => `${model.label || model.id}${model.reasoningOptions.length ? ` (${model.reasoningOptions.join("/")})` : ""}`).join(" · ") : "No models reported"}</TableCell>
      <TableCell className="font-mono text-[0.65rem] text-muted-foreground">write {policy.workspaceWrite ? "yes" : "no"} · network {policy.networkControl ? "yes" : "no"} · roots {policy.readOnlyRoots ? "yes" : "no"}</TableCell>
      <TableCell className="font-mono text-xs">{provider.activeRunCount}</TableCell>
    </TableRow>
  );
}
