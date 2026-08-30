import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Constraint, DirectionReference, UseCase } from "@shared/orchestration/direction";
import { useCaseApprovalHash } from "@shared/orchestration/direction";
import type { ActionDefinition, StateDefinition } from "@shared/orchestration/environment";
import type { RouteState } from "@/workspace/types";
import type { WorkspaceNavigation } from "@/workspace/useWorkspaceNavigation";
import { orchestrationActionFlowPath, orchestrationActionPath, orchestrationStatePath } from "@/workspace/routing";
import { reorderStates, reprioritizeActions } from "../authoringModels";
import type { OrchestrationConfigureData } from "../types";
import { orchestrationApi } from "../orchestrationApi";
import type { useOrchestrationMutation } from "../useOrchestrationMutation";
import { ActionWorkspace } from "./ActionWorkspace";
import { EnvironmentWorkspace } from "./EnvironmentWorkspace";
import { AgentDefinitionsWorkspace } from "./AgentDefinitionsWorkspace";
import { MarkdownDirectionWorkspace } from "./MarkdownDirectionWorkspace";
import { ResourceWorkspace } from "./ResourceWorkspace";
import { StateWorkspace } from "./StateWorkspace";
import { RuntimesWorkspace } from "./RuntimesWorkspace";
import { validateRunnableEnvironment } from "@shared/orchestration/gates";
import { LoopEngineeringWorkspace } from "./LoopEngineeringWorkspace";

type Mutation = ReturnType<typeof useOrchestrationMutation>;
type DirectionKind = "goals" | "adrs" | "constraints" | "use-cases";

export function OrchestrationConfigureOutlet({ route, data, navigate, mutation }: { route: RouteState; data: OrchestrationConfigureData; navigate: WorkspaceNavigation["navigate"]; mutation: Mutation }) {
  const { config, configHash } = data.project; const locked = data.references.activeRunIds.length > 0;
  const error = mutation.error ? <Alert variant="destructive" className="m-4"><AlertDescription>{mutation.error}</AlertDescription></Alert> : null;
  const saveDirection = async (kind: DirectionKind, value: DirectionReference | Constraint | UseCase, markdown: string, creating: boolean) => { const document = data[directionDataKey(kind)].find((item) => item.id === value.id); await mutation.run(() => orchestrationApi.saveDirection(kind, value, markdown, configHash, document?.contentHash ?? "absent", creating)); };
  let content;
  switch (route.workspaceView) {
    case "goals": case "adrs": case "constraints": {
      const kind = route.workspaceView; const key = directionDataKey(kind);
      content = <MarkdownDirectionWorkspace kind={kind} values={config.direction[key]} documents={data[key]} selectedId={route.entityId} locked={locked} navigate={navigate} onSave={(value, markdown, creating) => saveDirection(kind, value, markdown, creating)} onDelete={async (value) => { const document = data[key].find((item) => item.id === value.id); if (document) await mutation.run(() => orchestrationApi.deleteDirection(kind, value.id, configHash, document.contentHash)); }} />;
      break;
    }
    case "use-cases": content = <MarkdownDirectionWorkspace kind="use-cases" values={config.direction.useCases} documents={data.useCases} selectedId={route.entityId} locked={locked} navigate={navigate} onSave={(value, markdown, creating) => saveDirection("use-cases", value, markdown, creating)} onApprove={async (value) => { await mutation.run(() => orchestrationApi.approveUseCase(value.id, configHash, useCaseApprovalHash(value))); }} onDraft={async (value) => { await mutation.run(() => orchestrationApi.returnUseCaseToDraft(value.id, configHash)); }} />; break;
    case "environment": content = <LoopEngineeringWorkspace environment={config.environment} navigate={navigate}><EnvironmentWorkspace panel environment={config.environment} issues={validateRunnableEnvironment(config.environment, config.direction)} locked={locked} navigate={navigate} onSave={async (environment) => { await mutation.run(() => orchestrationApi.saveEnvironment(environment, configHash)); }} onCreate={async (id, name) => { const template = config.environment.states[0]!; const action = template.actions[0]!; const state: StateDefinition = { id, name, description: `${name} completion boundary`, order: config.environment.states.length + 1, useCaseIds: [...template.useCaseIds], actions: [{ ...action, id: `${id}-action-1`, name: `${name} first Action`, description: `Complete the first bounded Action for ${name}.`, priority: 1 }] }; await mutation.run(() => orchestrationApi.createState(state, configHash)); }} /></LoopEngineeringWorkspace>; break;
    case "state": { const state = config.environment.states.find((item) => item.id === route.stateId); const stateIndex = state ? config.environment.states.findIndex((item) => item.id === state.id) : -1; content = <LoopEngineeringWorkspace environment={config.environment} selectedStateId={state?.id} navigate={navigate}><StateWorkspace state={state} locked={locked} canMoveEarlier={stateIndex > 0} canMoveLater={stateIndex >= 0 && stateIndex < config.environment.states.length - 1} navigate={navigate} onMove={async (delta) => { if (!state) return; const orderedIds = reorderStates(config.environment.states, state.id, delta).map((item) => item.id); await mutation.run(() => orchestrationApi.reorderStates(orderedIds, configHash)); }} onSave={async (next: StateDefinition) => { await mutation.run(() => orchestrationApi.updateState(next, configHash)); }} onDelete={async () => { if (state && await mutation.run(() => orchestrationApi.deleteState(state.id, configHash))) navigate("/automation/loops"); }} onCreateAction={async (id, name) => { if (!state) return; const template = state.actions[0]!; const action: ActionDefinition = { ...template, id, name, description: `${name} bounded work`, priority: state.actions.length + 1 }; await mutation.run(() => orchestrationApi.createAction(state.id, action, configHash)); }} /></LoopEngineeringWorkspace>; break; }
    case "action": { const state = config.environment.states.find((item) => item.id === route.stateId); const action = state?.actions.find((item) => item.id === route.actionId); const actionIndex = action && state ? state.actions.findIndex((item) => item.id === action.id) : -1; const changeCanvasMode = (mode: "space" | "flow") => { if (!state || !action) return; navigate(mode === "flow" ? orchestrationActionFlowPath(state.id, action.id) : orchestrationActionPath(state.id, action.id), { bypassBlocker: true }); }; content = <LoopEngineeringWorkspace environment={config.environment} selectedStateId={state?.id} selectedActionId={action?.id} action={action} canvasMode={route.canvasMode} navigate={navigate} onActionFlowOpen={(stateId, actionId) => navigate(orchestrationActionFlowPath(stateId, actionId), { bypassBlocker: true })}><ActionWorkspace key={action?.id} stateId={state?.id} action={action} instructions={data.instructions} skills={data.skills} locked={locked} canvasMode={route.canvasMode} canMoveEarlier={actionIndex > 0} canMoveLater={Boolean(state && actionIndex >= 0 && actionIndex < state.actions.length - 1)} navigate={navigate} onCanvasModeChange={changeCanvasMode} onMove={async (delta) => { if (!state || !action) return; const orderedIds = reprioritizeActions(state.actions, action.id, delta).map((item) => item.id); await mutation.run(() => orchestrationApi.reprioritizeActions(state.id, orderedIds, configHash)); }} onDelete={async () => { if (!state || !action) return; await mutation.run(() => orchestrationApi.deleteAction(state.id, action.id, configHash)); navigate(orchestrationStatePath(state.id)); }} onSave={async (next: ActionDefinition) => { if (state) await mutation.run(() => orchestrationApi.updateAction(state.id, next, configHash)); }} /></LoopEngineeringWorkspace>; break; }
    case "instructions": content = <ResourceWorkspace kind="instructions" resources={data.instructions} references={data.references.entries} locked={locked} selectedId={route.entityId} navigate={navigate} onSave={async (id, source, hash, creating) => { await mutation.run(() => orchestrationApi.saveResource("instructions", id, source, hash, creating)); }} />; break;
    case "skills": content = <ResourceWorkspace kind="skills" resources={data.skills} references={data.references.entries} locked={locked} selectedId={route.entityId} navigate={navigate} onSave={async (id, source, hash, creating) => { await mutation.run(() => orchestrationApi.saveResource("skills", id, source, hash, creating)); }} />; break;
    case "agents": content = <AgentDefinitionsWorkspace profiles={config.agents} documents={data.agents} references={data.references.entries} selectedId={route.entityId} locked={locked} navigate={navigate} onSave={(value, source, creating, expectedHash) => mutation.run(() => orchestrationApi.saveAgent(value, source, configHash, expectedHash, creating))} onDelete={(value, expectedHash) => mutation.run(() => orchestrationApi.deleteAgent(value.id, configHash, expectedHash))} />; break;
    case "runtimes": content = <RuntimesWorkspace selectedId={route.entityId} navigate={navigate} />; break;
    default: content = <div className="p-6"><h1 className="text-xl font-semibold">Workspace unavailable</h1><p className="text-muted-foreground">This route is not part of the Configure workspace.</p></div>;
  }
  return <>{error}{content}</>;
}

const directionDataKey = (kind: DirectionKind): "goals" | "adrs" | "constraints" | "useCases" => kind === "use-cases" ? "useCases" : kind;
