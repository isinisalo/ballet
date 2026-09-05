import type { ResourceDocument } from "../types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { Constraint, DirectionReference, UseCase } from "@shared/orchestration/direction";
import { useCaseApprovalHash } from "@shared/orchestration/direction";
import { actionAgentId, type ActionDefinition, type StateDefinition } from "@shared/orchestration/environment";
import type { RouteState } from "@/workspace/types";
import type { WorkspaceNavigation } from "@/workspace/useWorkspaceNavigation";
import { orchestrationActionPath, orchestrationStatePath } from "@/workspace/routing";
import type { OrchestrationConfigureData } from "../types";
import { orchestrationApi } from "../orchestrationApi";
import type { useOrchestrationMutation } from "../useOrchestrationMutation";
import { ActionWorkspace } from "./ActionWorkspace";
import { EnvironmentWorkspace } from "./EnvironmentWorkspace";
import { AgentDefinitionsWorkspace } from "./AgentDefinitionsWorkspace";
import { MarkdownDirectionWorkspace } from "./MarkdownDirectionWorkspace";
import { ResourceWorkspace } from "./ResourceWorkspace";
import { StateWorkspace } from "./StateWorkspace";
import { validateRunnableEnvironment } from "@shared/orchestration/gates";
import { lazy } from "react";

const LoopEngineeringWorkspace = lazy(() => import("./LoopEngineeringWorkspace").then((module) => ({ default: module.LoopEngineeringWorkspace })));

type Mutation = ReturnType<typeof useOrchestrationMutation>;
type DirectionKind = "goals" | "adrs" | "constraints" | "use-cases";

export function OrchestrationConfigureOutlet({ route, data, navigate, mutation }: { route: RouteState; data: OrchestrationConfigureData; navigate: WorkspaceNavigation["navigate"]; mutation: Mutation }) {
  const { config, configHash } = data.project; const locked = data.references.activeRunIds.length > 0;
  const error = mutation.error ? <Alert variant="destructive" className="m-4"><AlertDescription>{mutation.error}</AlertDescription></Alert> : null;
  const saveDirection = async (kind: DirectionKind, value: DirectionReference | Constraint | UseCase, markdown: string, creating: boolean, hash: string) => {
    const saved = await mutation.execute(() => orchestrationApi.saveDirection(kind, value, markdown, configHash, hash, creating));
    if (creating) navigate(`/project/${kind}?id=${encodeURIComponent(value.id)}`, { bypassBlocker: true });
    return { kind: (kind === "use-cases" ? "use-case" : kind.slice(0, -1)) as ResourceDocument["kind"], id: value.id, content: markdown, contentHash: saved.documentHash };
  };

  let content;
  switch (route.workspaceView) {
    case "goals": case "adrs": case "constraints": {
      const kind = route.workspaceView; const key = directionDataKey(kind);
      content = <MarkdownDirectionWorkspace kind={kind} values={config.direction[key]} documents={data[key]} selectedId={route.entityId} locked={locked} navigate={navigate} onSave={(value, markdown, creating, hash) => saveDirection(kind, value, markdown, creating, hash)} onDelete={async (value) => { const document = data[key].find((item) => item.id === value.id); if (document) await mutation.run(() => orchestrationApi.deleteDirection(kind, value.id, configHash, document.contentHash)); }} />;
      break;
    }
    case "use-cases": content = <MarkdownDirectionWorkspace kind="use-cases" values={config.direction.useCases} documents={data.useCases} selectedId={route.entityId} locked={locked} navigate={navigate} onSave={(value, markdown, creating, hash) => saveDirection("use-cases", value, markdown, creating, hash)} onApprove={async (value) => { await mutation.run(() => orchestrationApi.approveUseCase(value.id, configHash, useCaseApprovalHash(value))); }} onDraft={async (value) => { await mutation.run(() => orchestrationApi.returnUseCaseToDraft(value.id, configHash)); }} />; break;
    case "environment": content = <LoopEngineeringWorkspace environment={config.environment} locked={locked} navigate={navigate}><EnvironmentWorkspace environment={config.environment} issues={validateRunnableEnvironment(config.environment)} locked={locked} creating={route.createMode === "state"} navigate={navigate} onCancelCreate={() => navigate("/automation/loops", { bypassBlocker: true })} onReorder={(ids) => mutation.run(() => orchestrationApi.reorderStates(ids, configHash))} onSave={async (environment) => { await mutation.run(() => orchestrationApi.saveEnvironment(environment, configHash)); }} onCreate={async (id, name) => { const template = config.environment.states[0]!.actions[0]!; const actionId = `${id}-action-1`; const action: ActionDefinition = { ...template, id: actionId, name: `${name} first Action`, description: `Complete the first bounded Action for ${name}.`, priority: 1, validation: { ...template.validation, agentId: actionAgentId(actionId, "validation") }, work: { ...template.work, agentId: actionAgentId(actionId, "work") } }; const state: StateDefinition = { id, name, description: `${name} completion boundary`, order: config.environment.states.length + 1, actions: [action] }; if (await mutation.run(() => orchestrationApi.createState(state, configHash))) navigate(orchestrationStatePath(id), { bypassBlocker: true }); }} /></LoopEngineeringWorkspace>; break;
    case "state": { const state = config.environment.states.find((item) => item.id === route.stateId); content = <LoopEngineeringWorkspace environment={config.environment} selectedStateId={state?.id} locked={locked} navigate={navigate}><StateWorkspace state={state} locked={locked} creating={route.createMode === "action"} navigate={navigate} onCancelCreate={() => state && navigate(orchestrationStatePath(state.id), { bypassBlocker: true })} onReorderActions={(ids) => state ? mutation.run(() => orchestrationApi.reprioritizeActions(state.id, ids, configHash)) : Promise.resolve(false)} onSave={async (next: StateDefinition) => { await mutation.run(() => orchestrationApi.updateState(next, configHash)); }} onDelete={async () => { if (state && await mutation.run(() => orchestrationApi.deleteState(state.id, configHash))) navigate("/automation/loops"); }} onDeleteAction={async (actionId) => { if (state) await mutation.run(() => orchestrationApi.deleteAction(state.id, actionId, configHash)); }} onCreateAction={async (id, name) => { if (!state) return; const template = state.actions[0]!; const action: ActionDefinition = { ...template, id, name, description: `${name} bounded work`, priority: state.actions.length + 1, validation: { ...template.validation, agentId: actionAgentId(id, "validation") }, work: { ...template.work, agentId: actionAgentId(id, "work") } }; if (await mutation.run(() => orchestrationApi.createAction(state.id, action, configHash))) navigate(orchestrationActionPath(state.id, id), { bypassBlocker: true }); }} /></LoopEngineeringWorkspace>; break; }
    case "action": { const state = config.environment.states.find((item) => item.id === route.stateId); const action = state?.actions.find((item) => item.id === route.actionId); const selectedAgentRole = route.agentRole === "validation" || route.agentRole === "work" ? route.agentRole : undefined; content = <LoopEngineeringWorkspace environment={config.environment} selectedStateId={state?.id} selectedActionId={action?.id} selectedAgentRole={selectedAgentRole} locked={locked} navigate={navigate}><ActionWorkspace key={action?.id} stateId={state?.id} action={action} selectedAgentRole={route.agentRole} skills={data.skills} locked={locked} onSave={async (next, agents) => { if (!state) return; return mutation.execute(async () => { await orchestrationApi.updateAction(state.id, next, configHash, agents); return orchestrationApi.action(state.id, next.id); }); }} /></LoopEngineeringWorkspace>; break; }
    case "instructions": content = <ResourceWorkspace kind="instructions" resources={data.instructions} references={data.references.entries} locked={locked} selectedId={route.entityId} navigate={navigate} onSave={async (id, source, hash, creating) => { const saved = await mutation.execute(() => orchestrationApi.saveResource("instructions", id, source, hash, creating)); if (creating) navigate(`/project/instructions?id=${encodeURIComponent(id)}`, { bypassBlocker: true }); return saved; }} />; break;
    case "skills": content = <ResourceWorkspace kind="skills" resources={data.skills} references={data.references.entries} locked={locked} selectedId={route.entityId} navigate={navigate} onSave={async (id, source, hash, creating) => { const saved = await mutation.execute(() => orchestrationApi.saveResource("skills", id, source, hash, creating)); if (creating) navigate(`/skills?id=${encodeURIComponent(id)}`, { bypassBlocker: true }); return saved; }} />; break;
    case "agents": content = <AgentDefinitionsWorkspace response={data.agents} skills={data.skills} selectedId={route.entityId} locked={locked} onSave={(id, input) => mutation.run(() => orchestrationApi.saveAgent(id, input))} />; break;
    default: content = <UnavailableWorkspace route={route} navigate={navigate} />;
  }
  return <>{error}{content}</>;
}

const directionDataKey = (kind: DirectionKind): "goals" | "adrs" | "constraints" | "useCases" => kind === "use-cases" ? "useCases" : kind;

function UnavailableWorkspace({ route, navigate }: { route: RouteState; navigate(path: string): void }) {
  return <div className="p-6"><h1 className="text-xl font-semibold">Workspace unavailable</h1><p className="text-muted-foreground">This route or selection is invalid.</p><Button className="mt-4" variant="outline" onClick={() => navigate(route.recoveryPath ?? "/automation/loops")}>Return to workspace</Button></div>;
}
