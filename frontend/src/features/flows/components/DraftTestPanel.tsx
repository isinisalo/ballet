import type { FlowComposerResult } from "backend/shared/flow";
import { DiagnosticsList } from "@/components/diagnostics/DiagnosticsList";
import { TechnicalDetails } from "@/components/forms/FormControls";
import { Badge } from "@/components/ui/badge";
import { titleFromKey, valueLabel } from "@/features/flows/model/flow-page-model";

export function DraftTestPanel({ result }: { result: FlowComposerResult }) {
  const diagnosticCount = result.validation.diagnostics.length;
  const operationCount = result.flow?.nodes.filter((node) => node.kind === "operation").length ?? 0;
  const test = result.test;
  return (
    <div className="grid gap-3 rounded-md border bg-background p-3">
      <div className="font-medium">{result.validation.valid ? "Flow can be saved" : "Flow needs fixes"}</div>
      <div className="text-sm text-muted-foreground">
        {result.validation.valid
          ? `${result.flow?.name ?? "This Flow"} has a valid trigger, ${operationCount} agent task${operationCount === 1 ? "" : "s"}, input mappings, and result events.`
          : `${diagnosticCount} configuration issue${diagnosticCount === 1 ? "" : "s"} need attention before activation.`}
      </div>
      {test ? (
        <div className="grid gap-3">
          <div className="grid gap-2 rounded-md border bg-muted/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium">Trigger test</span>
              <Badge variant={test.matched ? "default" : "outline"}>{test.matched ? "Matched" : "Not matched"}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{test.trigger.summary}</p>
            <PreviewGrid title="Example trigger data" values={test.trigger.exampleData} />
          </div>
          {test.operationInputs.map((input) => (
            <div key={`${input.taskName}-${input.status}`} className="grid gap-2 rounded-md border bg-muted/20 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">Operation input: {input.taskName}</span>
                <Badge variant={input.status === "routed" ? "default" : "outline"}>{input.status === "routed" ? "Input valid" : titleFromKey(input.status)}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{input.agentName ? `${input.agentName}: ` : ""}{input.summary}</p>
              <PreviewGrid title="Mapped operation input" values={input.input} />
            </div>
          ))}
          {test.exampleOutputs.map((output) => (
            <div key={output.taskName} className="grid gap-2 rounded-md border bg-muted/20 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">Example operation output: {output.taskName}</span>
                <Badge>{titleFromKey(output.status)}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{output.summary}</p>
              <PreviewGrid title="Example result fields" values={output.result} />
            </div>
          ))}
          {test.resultBranches.map((branch) => (
            <div key={`${branch.taskName}-${branch.branchName}`} className="grid gap-2 rounded-md border bg-muted/20 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">Matching result branch: {branch.branchName}</span>
                <Badge variant={branch.matched ? "default" : "outline"}>{branch.matched ? "Matched" : "Skipped"}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{branch.taskName}: {branch.summary}</p>
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <span className="block text-muted-foreground">Technical checks</span>
                  <span className="font-medium">{branch.gateSummary}</span>
                </div>
                <div>
                  <span className="block text-muted-foreground">Gate failure behavior</span>
                  <span className="font-medium">{branch.gateFailureBehavior}</span>
                </div>
              </div>
            </div>
          ))}
          {test.emittedEvents.map((event) => (
            <div key={`${event.eventType}-${event.subject ?? ""}`} className="grid gap-2 rounded-md border bg-muted/20 p-3">
              <span className="text-sm font-medium">Emitted event: {event.name}</span>
              <p className="text-sm text-muted-foreground">{event.summary}{event.subject ? ` Subject: ${event.subject}.` : ""}</p>
              <PreviewGrid title="Event data" values={event.data} />
            </div>
          ))}
          {test.downstreamTasks.length > 0 ? (
            <div className="grid gap-2 rounded-md border bg-muted/20 p-3">
              <span className="text-sm font-medium">Downstream tasks</span>
              <div className="grid gap-2">
                {test.downstreamTasks.map((task) => (
                  <div key={task.taskName} className="rounded-md border bg-background p-2 text-sm">
                    <span className="font-medium">{task.taskName}</span>
                    <span className="block text-muted-foreground">{task.agentName ? `${task.agentName}: ` : ""}{task.summary}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <div className="grid gap-2 rounded-md border bg-muted/20 p-3">
            <span className="text-sm font-medium">Plain-language trace</span>
            <ol className="grid gap-2">
              {test.trace.map((entry, index) => (
                <li key={`${entry.title}-${index}`} className="text-sm">
                  <span className="font-medium">{entry.title}</span>
                  <span className="block text-muted-foreground">{entry.summary}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      ) : null}
      <DiagnosticsList diagnostics={result.flow?.diagnostics ?? []} />
      <TechnicalDetails>
        <pre className="max-h-72 overflow-auto rounded-md bg-background p-3 text-xs">{JSON.stringify(result, null, 2)}</pre>
      </TechnicalDetails>
    </div>
  );
}

function PreviewGrid({ title, values }: { title: string; values: Record<string, unknown> }) {
  const entries = Object.entries(values);
  if (entries.length === 0) return null;
  return (
    <div className="grid gap-2">
      <span className="text-xs font-medium uppercase text-muted-foreground">{title}</span>
      <div className="grid gap-2 sm:grid-cols-2">
        {entries.map(([key, value]) => (
          <div key={key} className="rounded-md border bg-background p-2 text-sm">
            <span className="block font-medium">{titleFromKey(key)}</span>
            <span className="break-words text-muted-foreground">{valueLabel(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
