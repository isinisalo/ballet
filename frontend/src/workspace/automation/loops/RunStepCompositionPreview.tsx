import type { ExecutionProfile, ExecutionResourceEvidence, ExecutionTask, ProjectStep, RootRunDetail } from "@shared/api/workspace-contracts";
import { FileKey2, ShieldCheck } from "lucide-react";
import { MarkdownBody } from "../../documents/MarkdownBody";
import { canonicalResourceIds } from "./StepSkillsField";

const SYSTEM_ID = "system:execution-contract-v1";
const ATTEMPT_EVIDENCE_UNAVAILABLE = "Unavailable until an execution attempt is created";

export function RunStepCompositionPreview({ step, rootDetail, task }: {
  step: ProjectStep;
  rootDetail?: RootRunDetail;
  task?: ExecutionTask;
}) {
  if (step.type === "human") return <aside aria-label="StepRun composition" className="min-w-0 border-b border-divider-strong bg-panel-section p-3 sm:border-r sm:border-b-0"><h3 className="border-b border-divider-strong pb-2 text-xs font-medium">Human operator</h3><p className="py-3 text-xs text-muted-foreground">Human Steps have no execution composition.</p></aside>;
  const snapshotResources = rootDetail?.executionSnapshot.resources ?? [];
  const attemptEvidence = task?.spec.evidence;
  const resourceEvidence = attemptEvidence?.resources ?? fallbackEvidence(step, snapshotResources);
  const snapshotsByKey = new Map(snapshotResources.map((resource) => [resourceKey(resource.kind, resource.id), resource]));
  const profile = attemptEvidence?.executionProfile
    ?? rootDetail?.executionSnapshot.executionProfiles.find((candidate) => candidate.id === step.executionProfileId);
  const profileId = profile?.id ?? step.executionProfileId;

  return (
    <aside aria-label="StepRun composition" className="min-w-0 overflow-y-auto border-b border-divider-strong bg-panel-section sm:border-r sm:border-b-0">
      <article className="grid gap-3 p-3">
        <header className="flex items-start justify-between gap-3 border-b border-divider-strong pb-2"><div><h3 className="text-xs font-medium">Immutable composition</h3><p className="font-mono text-[0.62rem] text-muted-foreground">profile · {profileId}</p></div><span className="font-mono text-[0.58rem] text-secondary">Root Run snapshot</span></header>
        <RunExecutionProfile profile={profile} requestedId={profileId} />
        {resourceEvidence.map((resource) => {
          const snapshot = snapshotsByKey.get(resourceKey(resource.kind, resource.id));
          const title = resource.kind === "system" ? "System baseline" : resource.kind === "primary" ? "Primary instruction" : "Skill";
          return <RunResource key={`${resource.kind}:${resource.id}`} title={title} resource={resource} content={snapshot?.content} />;
        })}
        {!resourceEvidence.length ? <p className="text-xs text-destructive">Composition evidence is unavailable.</p> : null}
        <AttemptEvidence evidence={attemptEvidence} />
      </article>
    </aside>
  );
}

function AttemptEvidence({ evidence }: { evidence?: ExecutionTask["spec"]["evidence"] }) {
  return <footer className="border-t border-divider-strong pt-2 font-mono text-[0.6rem] leading-4 text-muted-foreground"><p>Composition v{evidence?.compositionVersion ?? 1}</p><p>Prompt SHA-256 · {evidence?.promptSha256 ?? ATTEMPT_EVIDENCE_UNAVAILABLE}</p><p>Output schema version · {evidence?.outputSchemaVersion ?? ATTEMPT_EVIDENCE_UNAVAILABLE}</p><p>Output schema SHA-256 · {evidence?.outputSchemaSha256 ?? ATTEMPT_EVIDENCE_UNAVAILABLE}</p><p>System → Primary → Skills → Task → Schema</p></footer>;
}

function RunExecutionProfile({ profile, requestedId }: { profile?: ExecutionProfile; requestedId: string }) {
  if (!profile) return <section className="rounded-lg border border-destructive/50 bg-background p-3 text-xs text-destructive">ExecutionProfile {requestedId} is unavailable from the Root Run snapshot.</section>;
  const fields = [
    ["ID", profile.id],
    ["Name", profile.name],
    ["Provider", profile.provider],
    ["Model", profile.model],
    ["Reasoning effort", profile.reasoningEffort],
    ["Network access", profile.networkAccess ? "Enabled" : "Disabled"]
  ];
  return <section aria-label="Captured ExecutionProfile" className="overflow-hidden rounded-lg border border-divider-strong bg-background"><h4 className="border-b border-divider-strong px-3 py-2 text-xs font-medium">Captured ExecutionProfile</h4><dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-2 gap-y-1 px-3 py-2 font-mono text-[0.6rem] leading-4">{fields.map(([label, value]) => <div className="contents" key={label}><dt className="text-muted-foreground">{label}</dt><dd className="break-all">{value}</dd></div>)}</dl></section>;
}

function RunResource({ title, resource, content }: { title: string; resource: ExecutionResourceEvidence; content?: string }) {
  const Icon = resource.kind === "system" ? ShieldCheck : FileKey2;
  return <section className="overflow-hidden rounded-lg border border-divider-strong bg-background"><header className="flex items-start gap-2 border-b border-divider-strong px-3 py-2"><Icon className="mt-0.5 size-3.5 text-muted-foreground" /><div className="min-w-0"><h4 className="text-xs font-medium">{title}</h4><p className="break-all font-mono text-[0.6rem] text-muted-foreground">{resource.origin} · {resource.id}</p>{resource.relativePath ? <p className="truncate font-mono text-[0.58rem] text-muted-foreground">{resource.relativePath}</p> : null}<p className="break-all font-mono text-[0.56rem] text-muted-foreground">source SHA-256 · {resource.sourceSha256}</p></div></header><div className="p-3 text-xs"><MarkdownBody source={content} emptyText="Snapshot content unavailable." /></div></section>;
}

function fallbackEvidence(step: Exclude<ProjectStep, { type: "human" }>, resources: RootRunDetail["executionSnapshot"]["resources"]): ExecutionResourceEvidence[] {
  const references = [
    { kind: "system" as const, id: SYSTEM_ID },
    { kind: "primary" as const, id: step.primaryInstructionId },
    ...canonicalResourceIds(step.skillIds).map((id) => ({ kind: "skill" as const, id }))
  ];
  return references.flatMap(({ kind, id }) => {
    const resource = resources.find((candidate) => candidate.kind === kind && candidate.id === id);
    return resource ? [{ kind: resource.kind, origin: resource.origin, id: resource.id, relativePath: resource.relativePath, sourceSha256: resource.sourceSha256 }] : [];
  });
}

const resourceKey = (kind: string, id: string) => `${kind}\0${id}`;
