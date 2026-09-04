import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LoopEngineeringNode } from "./loopEngineeringProjection";

export type LoopFlowNodeData = Record<string, unknown> & {
  item: LoopEngineeringNode;
  onActivate(item: LoopEngineeringNode): void;
};

export type LoopFlowNode = Node<LoopFlowNodeData, "loopNode">;

export function LoopEngineeringNodeView({ data }: NodeProps<LoopFlowNode>) {
  const { item } = data;
  const create = item.kind === "create-state" || item.kind === "create-action";
  const agent = item.kind === "validation-agent" || item.kind === "work-agent";
  return <div className="relative h-full w-full">
    <NodeHandles />
    <button
      type="button"
      className={cn("loop-engineering-node nodrag nopan", create && "loop-engineering-node--create")}
      data-kind={item.kind}
      data-selected={item.selected ? "true" : "false"}
      aria-label={item.ariaLabel}
      aria-pressed={create ? undefined : item.selected}
      disabled={Boolean(item.disabledReason)}
      title={item.disabledReason}
      onClick={() => data.onActivate(item)}
    >
      <span className="loop-engineering-node-heading">
        {agent ? <Bot aria-hidden="true" /> : null}
        <strong>{item.label}</strong>
      </span>
    </button>
  </div>;
}

function NodeHandles() {
  return <>
    <Handle id="top" type="target" position={Position.Top} isConnectable={false} className="loop-engineering-handle" />
    <Handle id="left" type="target" position={Position.Left} isConnectable={false} className="loop-engineering-handle" />
    <Handle id="right" type="source" position={Position.Right} isConnectable={false} className="loop-engineering-handle" />
    <Handle id="bottom" type="source" position={Position.Bottom} isConnectable={false} className="loop-engineering-handle" />
  </>;
}
