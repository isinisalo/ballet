import type { AgentComposition } from "../../../shared/orchestration/environment.js";
import type { ExecutionPromptEvidenceV12 } from "../../../shared/orchestration/execution.js";
import type { JsonValue } from "../../../shared/orchestration/primitives.js";
import { canonicalJson, sha256 } from "../../../shared/orchestration/primitives.js";
import type { RootSnapshotV15 } from "../../../shared/orchestration/runtime.js";
import type { TaskEnvelopeV11 } from "../../../shared/orchestration/taskEnvelopes.js";

const MAX_PROMPT_BYTES = 512 * 1024;
const MAX_ENVELOPE_BYTES = 192 * 1024;
const SYSTEM_ROLE_CONTRACT = "Ballet owns orchestration and human approvals. Obey the role, permissions, immutable context, and exact output contract.";

export const composeOrchestrationPrompt = (input: {
  snapshot: RootSnapshotV15;
  envelope: TaskEnvelopeV11;
  composition: AgentComposition;
}): ExecutionPromptEvidenceV12 => {
  const envelopeJson = canonicalJson(input.envelope as unknown as JsonValue);
  if (Buffer.byteLength(envelopeJson, "utf8") > MAX_ENVELOPE_BYTES) throw new Error("Task Envelope exceeds 192 KiB.");
  const primary = requireResource(input.snapshot, "instruction", input.composition.instructionResource);
  const skills = [...input.composition.skillResources].sort(compareUtf8).map(
    (id) => requireResource(input.snapshot, "skill", id)
  );
  const agent = input.snapshot.agents.find(({ id }) => id === input.composition.agentId);
  if (!agent) throw new Error(`Agent ${input.composition.agentId} is absent from snapshot.`);
  const { contentSha256: _agentContentSha256, ...promptAgent } = agent;
  void _agentContentSha256;
  const outputSchemaId = `${input.envelope.role}-outcome-v11` as ExecutionPromptEvidenceV12["outputSchemaId"];
  const outputRequirement = canonicalJson(outputContract(input.envelope.role, input.envelope.phase));
  const context = input.envelope.context;
  const prompt = [
    section("SYSTEM-AND-ROLE", SYSTEM_ROLE_CONTRACT),
    section("ACTION-DOMAIN-CONTEXT", canonicalJson(context)),
    section("HARD-CONSTRAINTS-AND-APPROVALS", hardConstraints(input.envelope.role)),
    section("TASK-ENVELOPE", envelopeJson),
    section("SKILLS", skills.map(({ id, content }) => `### ${id}\n${content}`).join("\n\n") || "No skills selected."),
    section("EXACT-OUTPUT-REQUIREMENT", outputRequirement)
  ].join("\n\n");
  if (Buffer.byteLength(prompt, "utf8") > MAX_PROMPT_BYTES) throw new Error("Execution prompt exceeds 512 KiB.");
  return {
    compositionVersion: 12,
    role: input.envelope.role,
    phase: input.envelope.phase,
    agent: promptAgent,
    resources: [
      { kind: "system", origin: "system", id: "ballet-orchestration-role-contract", sourceSha256: sha256(SYSTEM_ROLE_CONTRACT) },
      evidence(primary, "primary"),
      ...skills.map((skill) => evidence(skill, "skill"))
    ],
    prompt,
    promptSha256: sha256(prompt),
    taskEnvelopeVersion: 11,
    taskEnvelopeSha256: sha256(envelopeJson),
    outputSchemaVersion: 11,
    outputSchemaId,
    outputSchemaSha256: sha256(outputRequirement)
  };
};

const outputContract = (role: TaskEnvelopeV11["role"], phase: TaskEnvelopeV11["phase"]): JsonValue => ({
  schemaId: `${role}-outcome-v11`, version: 11, role, phase,
  transport: "one strict JSON object; no prose, markdown fence, unknown field, or alternate enum"
});
const hardConstraints = (role: TaskEnvelopeV11["role"]): string =>
  `Role=${role}; toolPolicy=${role === "work" ? "workspace_write" : "read_only"}; provider approvalPolicy=never; no routing, approval, or orchestration-state mutation.`;
const section = (name: string, content: string): string => `<<< BALLET ORCHESTRATION COMPOSITION V12 · ${name} >>>\n${content}\n<<< END ${name} >>>`;
const evidence = (
  resource: RootSnapshotV15["resources"][number], kind: "primary" | "skill"
): ExecutionPromptEvidenceV12["resources"][number] => ({
  kind, origin: "project", id: resource.id, relativePath: resource.relativePath, sourceSha256: resource.sourceSha256
});
const requireResource = (snapshot: RootSnapshotV15, kind: "instruction" | "skill", id: string) => {
  const resource = snapshot.resources.find((candidate) => candidate.kind === kind && candidate.id === id);
  if (!resource) throw new Error(`Snapshot is missing ${kind} ${id}.`);
  return resource;
};
const compareUtf8 = (left: string, right: string): number => Buffer.compare(Buffer.from(left), Buffer.from(right));
