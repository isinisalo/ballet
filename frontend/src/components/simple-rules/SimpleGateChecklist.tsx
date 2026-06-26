import type { EmissionGate } from "backend/shared/emission-policy";

export function SimpleGateChecklist({
  gates,
  gitCommitField,
  onChange,
  onGitCommitFieldChange,
  gitCommitFields
}: {
  gates: EmissionGate[];
  gitCommitField: string;
  onChange: (gates: EmissionGate[]) => void;
  onGitCommitFieldChange: (field: string) => void;
  gitCommitFields: string[];
}) {
  const hasSummary = gates.some((gate) => gate.type === "required_value" && gate.path === "/output/summary");
  const hasChecks = gates.some((gate) => gate.type === "no_failed_checks");
  const gitGate = gates.find((gate) => gate.type === "git_commit_exists");
  const toggle = (enabled: boolean, gate: EmissionGate, predicate: (candidate: EmissionGate) => boolean) => {
    onChange(enabled ? [...gates.filter((candidate) => !predicate(candidate)), gate] : gates.filter((candidate) => !predicate(candidate)));
  };

  return (
    <div className="grid gap-2 rounded-md border bg-muted/20 p-3">
      <h3 className="text-sm font-medium">Checks before publishing</h3>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={hasSummary} onChange={(event) => toggle(event.target.checked, { type: "required_value", path: "/output/summary" }, (gate) => gate.type === "required_value" && gate.path === "/output/summary")} />
        Require a summary
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={hasChecks} onChange={(event) => toggle(event.target.checked, { type: "no_failed_checks", path: "/output/evidence/checks" }, (gate) => gate.type === "no_failed_checks")} />
        Require no failed checks
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={Boolean(gitGate)} onChange={(event) => toggle(event.target.checked, { type: "git_commit_exists", path: gitCommitField || "/output/result/gitSha" }, (gate) => gate.type === "git_commit_exists")} />
        Verify Git commit exists
      </label>
      {gitGate && gitCommitFields.length ? (
        <select className="h-10 rounded-md border bg-background px-3 text-sm" aria-label="Git commit result field" value={gitCommitField} onChange={(event) => onGitCommitFieldChange(event.target.value)}>
          {gitCommitFields.map((field) => <option key={field} value={`/output/result/${field}`}>{field}</option>)}
        </select>
      ) : null}
    </div>
  );
}
