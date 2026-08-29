import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Constraint, DirectionReference, UseCase } from "@shared/orchestration/direction";
import type { ActionDefinition, CriticConfiguration, ExecutionProfile, StateDefinition } from "@shared/orchestration/environment";
import type { RouteState } from "@/workspace/types";
import { reorderStates, reprioritizeActions } from "../authoringModels";
import type { OrchestrationConfigureData } from "../types";
import { orchestrationApi } from "../orchestrationApi";
import type { useOrchestrationMutation } from "../useOrchestrationMutation";
import { ActionWorkspace } from "./ActionWorkspace";
import { CriticWorkspace } from "./CriticWorkspace";
import { DirectionWorkspace } from "./DirectionWorkspace";
import { EnvironmentWorkspace } from "./EnvironmentWorkspace";
import { ExecutionProfilesWorkspace } from "./ExecutionProfilesWorkspace";
import { ResourceWorkspace } from "./ResourceWorkspace";
import { StateWorkspace } from "./StateWorkspace";
import { UseCasesWorkspace } from "./UseCasesWorkspace";
import { validateRunnableEnvironment } from "@shared/orchestration/gates";

type Mutation = ReturnType<typeof useOrchestrationMutation>;
type DirectionKind = "goals" | "adrs" | "constraints" | "use-cases";

export function OrchestrationConfigureOutlet({ route, data, navigate, mutation }: { route: RouteState; data: OrchestrationConfigureData; navigate(path: string): void; mutation: Mutation }) {
  const { config, configHash } = data.project; const locked = data.references.activeRunIds.length > 0;
  const error = mutation.error ? <Alert variant="destructive" className="m-4"><AlertDescription>{mutation.error}</AlertDescription></Alert> : null;
  const saveDirection = async (kind: DirectionKind, value: DirectionReference | Constraint | UseCase, markdown: string, creating: boolean) => { const document = data[directionDataKey(kind)].find((item) => item.id === value.id); await mutation.run(() => orchestrationApi.saveDirection(kind, value, markdown, configHash, document?.contentHash ?? "absent", creating)); };
  const updateProject = (next: typeof config) => mutation.run(() => orchestrationApi.putProject(next, configHash)).then(() => undefined);
  let content;
  switch (route.workspaceView) {
    case "direction": content = <DirectionWorkspace direction={config.direction} documents={{ goals: data.goals, adrs: data.adrs, constraints: data.constraints }} references={data.references.entries} locked={locked} onSave={(kind, value, markdown, creating) => saveDirection(kind, value, markdown, creating)} onDelete={async (kind, value) => { const document = data[directionDataKey(kind)].find((item) => item.id === value.id); if (document) await mutation.run(() => orchestrationApi.deleteDirection(kind, value.id, configHash, document.contentHash)); }} />; break;
    case "use-cases": content = <UseCasesWorkspace useCases={config.direction.useCases} documents={data.useCases} locked={locked} environmentUsage={config.environment.states.flatMap((state) => [...state.useCaseIds, ...state.actions.flatMap((action) => action.useCaseIds)])} onSave={(value, markdown, creating) => saveDirection("use-cases", value, markdown, creating)} onApprove={async (value) => { await mutation.run(() => orchestrationApi.approveUseCase(value.id, configHash)); }} onDraft={async (value) => { await mutation.run(() => orchestrationApi.returnUseCaseToDraft(value.id, configHash)); }} />; break;
    case "environment": content = <EnvironmentWorkspace environment={config.environment} issues={validateRunnableEnvironment(config.environment, config.direction)} locked={locked} navigate={navigate} onMove={async (id, delta) => { const orderedIds = reorderStates(config.environment.states, id, delta).map((state) => state.id); await mutation.run(() => orchestrationApi.reorderStates(orderedIds, configHash)); }} />; break;
    case "state": { const state = config.environment.states.find((item) => item.id === route.stateId); content = <StateWorkspace state={state} locked={locked} navigate={navigate} onSave={async (next: StateDefinition) => { await mutation.run(() => orchestrationApi.updateState(next, configHash)); }} onMoveAction={async (id, delta) => { if (!state) return; const orderedIds = reprioritizeActions(state.actions, id, delta).map((action) => action.id); await mutation.run(() => orchestrationApi.reprioritizeActions(state.id, orderedIds, configHash)); }} />; break; }
    case "action": { const state = config.environment.states.find((item) => item.id === route.stateId); const action = state?.actions.find((item) => item.id === route.actionId); content = <ActionWorkspace stateId={state?.id} action={action} profiles={config.executionProfiles} instructions={data.instructions} skills={data.skills} locked={locked} navigate={navigate} onSave={async (next: ActionDefinition) => { if (state) await mutation.run(() => orchestrationApi.updateAction(state.id, next, configHash)); }} />; break; }
    case "instructions": content = <ResourceWorkspace kind="instructions" resources={data.instructions} references={data.references.entries} locked={locked} onSave={async (id, source, hash, creating) => { await mutation.run(() => orchestrationApi.saveResource("instructions", id, source, hash, creating)); }} />; break;
    case "skills": content = <ResourceWorkspace kind="skills" resources={data.skills} references={data.references.entries} locked={locked} onSave={async (id, source, hash, creating) => { await mutation.run(() => orchestrationApi.saveResource("skills", id, source, hash, creating)); }} />; break;
    case "execution-profiles": content = <ExecutionProfilesWorkspace profiles={config.executionProfiles} references={data.references.entries} locked={locked} onSave={(profiles: ExecutionProfile[]) => updateProject({ ...config, executionProfiles: profiles })} />; break;
    case "critic": content = <CriticWorkspace critic={config.critic} statuses={data.schedules} locked={locked} onSave={(critic: CriticConfiguration) => updateProject({ ...config, critic })} onManual={async () => { await mutation.run(orchestrationApi.manualCritic); }} />; break;
    default: content = <div className="p-6"><h1 className="text-xl font-semibold">Workspace unavailable</h1><p className="text-muted-foreground">This route is not part of the Configure workspace.</p></div>;
  }
  return <>{error}{content}</>;
}

const directionDataKey = (kind: DirectionKind): "goals" | "adrs" | "constraints" | "useCases" => kind === "use-cases" ? "useCases" : kind;
