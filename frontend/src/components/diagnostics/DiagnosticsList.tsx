import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import type { FlowDiagnostic, WorkspaceDiagnostic } from "backend/shared/flow";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Diagnostic = FlowDiagnostic | WorkspaceDiagnostic;

const severityTone = (severity: string): "default" | "secondary" | "destructive" | "outline" => {
  if (severity === "error") return "destructive";
  if (severity === "warning") return "secondary";
  return "outline";
};

export function HealthBadge({ health }: { health: "ready" | "warning" | "invalid" }) {
  const label = health === "ready" ? "Ready" : health === "warning" ? "Has warnings" : "Cannot run";
  return <Badge variant={health === "invalid" ? "destructive" : health === "warning" ? "secondary" : "default"}>{label}</Badge>;
}

export function DiagnosticsList({ diagnostics }: { diagnostics: Diagnostic[] }) {
  if (diagnostics.length === 0) {
    return (
      <Alert>
        <CheckCircle2 className="size-4" />
        <AlertDescription>No configuration problems found.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="grid gap-2">
      {diagnostics.map((diagnostic, index) => {
        const Icon = diagnostic.severity === "error" ? AlertCircle : Info;
        return (
          <div key={`${diagnostic.title}-${index}`} className="grid gap-2 rounded-md border bg-background p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Icon className="size-4 text-muted-foreground" />
              <span className="font-medium">{diagnostic.title}</span>
              <Badge variant={severityTone(diagnostic.severity)}>{diagnostic.severity}</Badge>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">{diagnostic.explanation}</p>
            {diagnostic.suggestedFix ? <p className="text-sm text-foreground">{diagnostic.suggestedFix}</p> : null}
          </div>
        );
      })}
    </div>
  );
}
