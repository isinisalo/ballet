import type { ExecutionProfile, LocalRuntime, ProjectExecutionStep, ProjectInstruction, ProjectLoopNode, Skill } from "@shared/api/workspace-contracts";
import type { ReactNode } from "react";
import { isProjectExecutionStep, isProjectTerminalNode } from "@shared/api/workspace-contracts";
import { Bot, CircleStop, FileKey2, ShieldCheck } from "lucide-react";
import { MarkdownBody } from "../../documents/MarkdownBody";
import { canonicalResourceIds } from "./StepSkillsField";
import { executionProfileBlockingReason } from "../../executionProfiles/executionProfileOptions";

const SYSTEM_INSTRUCTION_ID = "system:execution-contract-v1";

export function StepCompositionPreview({ step, profiles, instructions, skills, runtime }: {
  step: ProjectLoopNode;
  profiles: ExecutionProfile[];
  instructions: ProjectInstruction[];
  skills: Skill[];
  runtime?: LocalRuntime;
}) {
  if (isProjectTerminalNode(step)) return <NonExecutionPreview icon={<CircleStop />} title={step.id} message="Terminal nodes have no execution composition." />;
  if (!isProjectExecutionStep(step)) return <NonExecutionPreview icon={<ShieldCheck />} title="Human operator" message="Human Steps have no execution composition." />;
  return <ExecutionCompositionPreview step={step} profiles={profiles} instructions={instructions} skills={skills} runtime={runtime} />;
}

function ExecutionCompositionPreview({ step, profiles, instructions, skills, runtime }: {
  step: ProjectExecutionStep;
  profiles: ExecutionProfile[];
  instructions: ProjectInstruction[];
  skills: Skill[];
  runtime?: LocalRuntime;
}) {
  const profile = profiles.find((candidate) => candidate.id === step.executionProfileId);
  const primary = instructions.find((candidate) => candidate.id === step.primaryInstructionId);
  const selectedSkills = canonicalResourceIds(step.skillIds).map((id) => skills.find((skill) => skill.id === id) ?? id);
  const valid = compositionIsValid(step, profile, primary, selectedSkills, runtime);

  return (
    <aside aria-label="Step composition preview" className="step-composition-preview min-w-0 overflow-y-auto border-b border-divider-strong bg-panel-section sm:border-r sm:border-b-0">
      <article className="min-w-0 px-3 py-3">
        <header className="mb-3 flex items-start justify-between gap-3 border-b border-divider-strong pb-2">
          <div className="flex min-w-0 items-center gap-2"><Bot className="size-3.5 shrink-0 text-muted-foreground" /><div className="min-w-0"><h3 className="text-xs font-medium">Step composition</h3><p className="truncate font-mono text-[0.62rem] text-muted-foreground">{step.id}</p></div></div>
          <span className={`font-mono text-[0.58rem] ${valid ? "text-secondary" : "text-destructive"}`}>{valid ? "Valid" : "Invalid"}</span>
        </header>
        <div className="grid gap-4">
          <ResourceSection icon={<ShieldCheck />} title="System baseline" origin="system" id={SYSTEM_INSTRUCTION_ID} status="Always applied · read-only"><p className="text-xs leading-5 text-muted-foreground">Execution authority, permission boundaries, secret handling, structured outcomes, and verification evidence.</p></ResourceSection>
          <PrimaryResource step={step} primary={primary} />
          <SkillsResources selectedSkills={selectedSkills} />
        </div>
        <footer className="mt-4 border-t border-divider-strong pt-2 font-mono text-[0.6rem] leading-4 text-muted-foreground"><p>Composition v1</p><p>System → Primary → Skills → Task → Schema</p><p>Profile · {profile?.id ?? (step.executionProfileId || "Not selected")}</p></footer>
      </article>
    </aside>
  );
}

const compositionIsValid = (
  step: ProjectExecutionStep,
  profile: ExecutionProfile | undefined,
  primary: ProjectInstruction | undefined,
  skills: Array<Skill | string>,
  runtime?: LocalRuntime
) => Boolean(step.description.trim()
  && profile
  && (!runtime || !executionProfileBlockingReason(profile, runtime))
  && primary?.valid
  && skills.every((skill) => typeof skill !== "string" && skill.valid));

function PrimaryResource({ step, primary }: { step: ProjectExecutionStep; primary?: ProjectInstruction }) {
  const valid = Boolean(primary?.valid);
  return <ResourceSection icon={<FileKey2 />} title={primary?.title ?? "Primary instruction missing"} origin={primary?.origin ?? "project"} id={step.primaryInstructionId || "Not selected"} path={primary?.relativePath} invalid={!valid} status={valid ? "Primary" : "Missing or invalid"}><MarkdownBody source={primary?.body} title={primary?.title} emptyText={valid ? "Instruction body is empty." : "Select one valid Project instruction."} /></ResourceSection>;
}

function SkillsResources({ selectedSkills }: { selectedSkills: Array<Skill | string> }) {
  return <section className="grid gap-2"><h4 className="font-mono text-[0.62rem] font-medium uppercase tracking-[0.05em] text-muted-foreground">Skills · {selectedSkills.length}</h4>{selectedSkills.length ? selectedSkills.map((skill) => <SkillResource key={typeof skill === "string" ? skill : skill.id} skill={skill} />) : <p className="text-xs text-muted-foreground">No skills selected.</p>}</section>;
}

function SkillResource({ skill }: { skill: Skill | string }) {
  if (typeof skill === "string") return <ResourceSection icon={<FileKey2 />} title="Skill missing" origin="project" id={skill} invalid status="Missing or invalid" />;
  return <ResourceSection icon={<FileKey2 />} title={skill.name} origin={skill.origin} id={skill.id} path={skill.relativePath} invalid={!skill.valid} status={skill.valid ? "Selected" : "Invalid"}><MarkdownBody source={skill.body} title={skill.name} emptyText="Skill body is empty." /></ResourceSection>;
}

function ResourceSection({ icon, title, origin, id, path, status, invalid = false, children }: {
  icon: ReactNode;
  title: string;
  origin: string;
  id: string;
  path?: string;
  status: string;
  invalid?: boolean;
  children?: ReactNode;
}) {
  return <section className={`overflow-hidden rounded-lg border bg-background ${invalid ? "border-destructive/50" : "border-divider-strong"}`}><header className="flex items-start gap-2 border-b border-divider-strong px-3 py-2"><span className="mt-0.5 text-muted-foreground [&>svg]:size-3.5">{icon}</span><div className="min-w-0 flex-1"><h4 className="text-xs font-medium">{title}</h4><p className="break-all font-mono text-[0.6rem] text-muted-foreground">{origin} · {id}</p>{path ? <p className="truncate font-mono text-[0.58rem] text-muted-foreground">{path}</p> : null}</div><span className={`shrink-0 font-mono text-[0.56rem] ${invalid ? "text-destructive" : "text-muted-foreground"}`}>{status}</span></header>{children ? <div className="p-3 text-xs">{children}</div> : null}</section>;
}

function NonExecutionPreview({ icon, title, message }: { icon: ReactNode; title: string; message: string }) {
  return <aside aria-label="Step composition preview" className="min-w-0 border-b border-divider-strong bg-panel-section p-3 sm:border-r sm:border-b-0"><div className="flex items-center gap-2 border-b border-divider-strong pb-2 text-xs font-medium"><span className="text-muted-foreground [&>svg]:size-3.5">{icon}</span>{title}</div><p className="py-3 text-xs text-muted-foreground">{message}</p></aside>;
}
