import type { FlowTestResult } from "backend/shared/flow";
import { TechnicalDetails } from "@/components/forms/FormControls";

export function FlowTestPanel({ result }: { result: FlowTestResult }) {
  return (
    <div className="grid gap-3 rounded-md border bg-background p-3">
      <div className="font-medium">{result.matched ? "Test matched the trigger" : "Test did not match the trigger"}</div>
      <ol className="grid gap-2">
        {result.trace.map((entry, index) => (
          <li key={`${entry.title}-${index}`} className="grid gap-1 rounded-md border bg-muted/20 p-3">
            <span className="text-sm font-medium">{entry.title}</span>
            <span className="text-sm text-muted-foreground">{entry.summary}</span>
          </li>
        ))}
      </ol>
      <TechnicalDetails>
        <pre className="max-h-72 overflow-auto rounded-md bg-background p-3 text-xs">{JSON.stringify(result, null, 2)}</pre>
      </TechnicalDetails>
    </div>
  );
}
