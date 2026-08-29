import type { EnvironmentDefinition } from "@shared/orchestration/environment";
import { orchestrationActionPath, orchestrationStatePath } from "@/workspace/routing";
import { ActionPlanetArtwork, StateRouteArtwork } from "./LoopEngineeringArtwork";
import { projectLoopEngineering } from "./loopEngineeringProjection";
import "./LoopEngineeringCanvas.css";

export function LoopEngineeringCanvas({ environment, selectedStateId, selectedActionId, navigate, onActionFlowOpen }: {
  environment: EnvironmentDefinition;
  selectedStateId?: string;
  selectedActionId?: string;
  navigate(path: string): void;
  onActionFlowOpen?(stateId: string, actionId: string): void;
}) {
  const projection = projectLoopEngineering(environment, selectedStateId, selectedActionId);
  return <section className="loop-engineering-canvas" aria-label={`Loop Engineering canvas for Environment ${environment.id}`}>
    <div className="loop-engineering-legend">ENVIRONMENT <span>{environment.id} · ordered State / Action projection</span></div>
    <div className="loop-engineering-scroll">
      <div className="loop-engineering-stage" style={{ width: projection.width, height: projection.height }}>
        <svg className="loop-engineering-edges" width={projection.width} height={projection.height} aria-hidden="true">
          {projection.edges.map((edge) => <g key={edge.id}>
            <path d={edge.path} className={`loop-engineering-edge loop-engineering-edge--${edge.tone}`} />
            {edge.points.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="3.5" className="loop-engineering-connection" />)}
          </g>)}
        </svg>
        {projection.states.map((state) => <button key={state.id} type="button" className="loop-engineering-state" data-selected={state.selected ? "true" : "false"} aria-pressed={state.selected} aria-label={`Open State ${state.id}: ${state.name}`} style={{ left: state.x - 22, top: state.y - 22 }} onClick={() => navigate(orchestrationStatePath(state.id))}>
          <span className="loop-engineering-state-icon"><StateRouteArtwork /></span>
          <span className="loop-engineering-state-label"><small>STATE {state.order}</small><strong>{state.name}</strong><code>{state.id}</code></span>
        </button>)}
        {projection.actions.map((action) => <button key={action.id} type="button" className="loop-engineering-action" data-selected={action.selected ? "true" : "false"} aria-pressed={action.selected} aria-label={`Open Action ${action.id}: ${action.name}`} style={{ left: action.x, top: action.y }} onClick={() => selectedStateId && navigate(orchestrationActionPath(selectedStateId, action.id))} onDoubleClick={() => selectedStateId && onActionFlowOpen?.(selectedStateId, action.id)}>
          <ActionPlanetArtwork artwork={action.artwork} size={action.size} />
          <code className="loop-engineering-action-label">{action.id}</code>
        </button>)}
      </div>
    </div>
    <p className="loop-engineering-caption">Authoring order only · runtime status remains in Run.</p>
  </section>;
}
