import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import type { CanvasNodeSize, CanvasNodeStyle } from "@shared/api/workspace-contracts";
import { canvasNodeSizeCatalog } from "@shared/api/workspace-contracts";
import { Button } from "@/components/ui/button";

export interface SpaceCanvasNode {
  id: string;
  label: string;
  role: string;
  nodeStyle: CanvasNodeStyle;
  nodeSize: CanvasNodeSize;
  active?: boolean;
  locked?: boolean;
}

interface Point { x: number; y: number; }
interface PositionedNode extends SpaceCanvasNode, Point {}

export function SpaceEngineeringCanvas({ hub, repair, children, onHub, onRepair, onChild }: {
  hub: SpaceCanvasNode;
  repair?: SpaceCanvasNode;
  children: SpaceCanvasNode[];
  onHub: () => void;
  onRepair?: () => void;
  onChild: (id: string) => void;
}) {
  const layout = useMemo(() => spaceRadialLayout(children), [children]);
  const [zoom, setZoom] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; left: number; top: number }>();
  const hubPoint = { x: layout.width / 2, y: layout.height / 2 };
  const repairPoint = { x: hubPoint.x + 130, y: hubPoint.y + 92 };
  const terminalX = layout.width - 80;
  useCenterOnResize(scrollRef, layout.width, layout.height);
  const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button")) return;
    const target = scrollRef.current;
    if (!target) return;
    target.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, left: target.scrollLeft, top: target.scrollTop };
  };
  const pointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const target = scrollRef.current;
    if (!drag || !target) return;
    target.scrollLeft = drag.left - (event.clientX - drag.x);
    target.scrollTop = drag.top - (event.clientY - drag.y);
  };
  return (
    <div className="relative min-h-0 min-w-0 flex-1">
      <div className="absolute right-3 top-3 z-20 flex gap-1 rounded border border-divider-strong bg-card/90 p-1 shadow-lg" aria-label="Canvas zoom">
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Zoom out" onClick={() => setZoom((value) => Math.max(0.55, value - 0.1))}><Minus /></Button>
        <span className="grid min-w-11 place-items-center font-mono text-[0.65rem] text-muted-foreground">{Math.round(zoom * 100)}%</span>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Zoom in" onClick={() => setZoom((value) => Math.min(1.4, value + 0.1))}><Plus /></Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Reset zoom" onClick={() => setZoom(1)}><RotateCcw /></Button>
      </div>
      <div
        ref={scrollRef}
        className="space-engineering-canvas size-full cursor-grab overflow-auto active:cursor-grabbing"
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={() => { dragRef.current = undefined; }}
        onPointerCancel={() => { dragRef.current = undefined; }}
      >
        <div style={{ width: layout.width * zoom, height: layout.height * zoom }}>
          <div className="space-engineering-stage" style={{ width: layout.width, height: layout.height, transform: `scale(${zoom})` }}>
            <svg className="pointer-events-none absolute inset-0" width={layout.width} height={layout.height} aria-hidden="true">
              {layout.nodes.map((node) => <line key={node.id} className="space-spoke" x1={hubPoint.x} y1={hubPoint.y} x2={node.x} y2={node.y} />)}
              {repair ? <line className="space-spoke space-spoke--repair" x1={hubPoint.x} y1={hubPoint.y} x2={repairPoint.x} y2={repairPoint.y} /> : null}
              <line className="space-spoke" x1={hubPoint.x} y1={hubPoint.y} x2={terminalX} y2={hubPoint.y - 38} />
              <line className="space-spoke" x1={hubPoint.x} y1={hubPoint.y} x2={terminalX} y2={hubPoint.y + 38} />
            </svg>
            <CanvasNodeButton node={hub} point={hubPoint} onClick={onHub} />
            {repair ? <CanvasNodeButton node={repair} point={repairPoint} onClick={() => onRepair?.()} /> : null}
            {layout.nodes.map((node) => <CanvasNodeButton key={node.id} node={node} point={node} onClick={() => onChild(node.id)} />)}
            <div className="space-terminal" style={{ left: terminalX, top: hubPoint.y - 38 }}>PASS</div>
            <div className="space-terminal" style={{ left: terminalX, top: hubPoint.y + 38 }}>FAIL</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function JobEngineeringCanvas({ work, validation, onWork, onValidation }: {
  work: SpaceCanvasNode;
  validation: SpaceCanvasNode;
  onWork: () => void;
  onValidation: () => void;
}) {
  const width = 860;
  const height = 560;
  const workPoint = { x: 300, y: 270 };
  const validationPoint = { x: 570, y: 270 };
  const scrollRef = useRef<HTMLDivElement>(null);
  useCenterOnResize(scrollRef, width, height);
  return (
    <div ref={scrollRef} className="space-engineering-canvas min-h-0 min-w-0 flex-1 overflow-auto">
      <div className="space-engineering-stage mx-auto" style={{ width, height }}>
        <svg className="pointer-events-none absolute inset-0" width={width} height={height} aria-hidden="true">
          <defs>
            <marker id="mint-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="var(--canvas-flow)" /></marker>
            <marker id="amber-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="var(--tertiary)" /></marker>
          </defs>
          <line className="space-spoke" x1={workPoint.x + 52} y1={workPoint.y} x2={validationPoint.x - 52} y2={validationPoint.y} markerEnd="url(#mint-arrow)" />
          <path d={`M ${validationPoint.x} ${validationPoint.y + 62} C ${validationPoint.x} 430, ${workPoint.x} 430, ${workPoint.x} ${workPoint.y + 62}`} fill="none" stroke="var(--tertiary)" strokeWidth="1.5" strokeDasharray="8 7" markerEnd="url(#amber-arrow)" />
          <line className="space-spoke" x1={validationPoint.x + 52} y1={validationPoint.y} x2={795} y2={235} />
          <line className="space-spoke" x1={validationPoint.x + 52} y1={validationPoint.y} x2={795} y2={305} />
        </svg>
        <CanvasNodeButton node={work} point={workPoint} onClick={onWork} />
        <CanvasNodeButton node={validation} point={validationPoint} onClick={onValidation} />
        <div className="absolute font-mono text-[0.65rem] text-secondary" style={{ left: 428, top: 244 }}>VALIDATE</div>
        <div className="absolute font-mono text-[0.65rem] text-tertiary" style={{ left: 410, top: 410 }}>RETRY</div>
        <div className="space-terminal" style={{ left: 830, top: 235 }}>PASS</div>
        <div className="space-terminal" style={{ left: 830, top: 305 }}>FAIL</div>
      </div>
    </div>
  );
}

function CanvasNodeButton({ node, point, onClick }: { node: SpaceCanvasNode; point: Point; onClick: () => void }) {
  const pixels = canvasNodeSizeCatalog[node.nodeSize].pixels;
  const size = Math.max(58, pixels * 1.45);
  return (
    <button
      type="button"
      className="space-node"
      style={{ left: point.x, top: point.y, "--space-node-size": `${size}px` } as CSSProperties}
      data-style={node.nodeStyle}
      data-active={node.active ? "true" : "false"}
      aria-label={`${node.role} ${node.label}${node.locked ? ", active run locked" : ""}`}
      onClick={onClick}
    >
      <span className="space-node-planet" aria-hidden="true" />
      <span className="space-node-id" title={node.id}>{node.label}</span>
      <span className="space-node-role">{node.role}</span>
    </button>
  );
}

function useCenterOnResize(
  scrollRef: { current: HTMLDivElement | null },
  width: number,
  height: number
) {
  useLayoutEffect(() => {
    const target = scrollRef.current;
    if (!target) return;
    const center = () => {
      target.scrollLeft = Math.max(0, (target.scrollWidth - target.clientWidth) / 2);
      target.scrollTop = Math.max(0, (target.scrollHeight - target.clientHeight) / 2);
    };
    center();
    const observer = new ResizeObserver(center);
    observer.observe(target);
    return () => observer.disconnect();
  }, [height, scrollRef, width]);
}

export function spaceRadialLayout(children: SpaceCanvasNode[]): { width: number; height: number; nodes: PositionedNode[] } {
  const capacities = [8, 12, 16, 20, 24];
  const rings: SpaceCanvasNode[][] = [];
  let cursor = 0;
  for (const capacity of capacities) {
    if (cursor >= children.length) break;
    rings.push(children.slice(cursor, cursor + capacity));
    cursor += capacity;
  }
  while (cursor < children.length) {
    rings.push(children.slice(cursor, cursor + 24));
    cursor += 24;
  }
  const maxRadius = Math.max(320, 320 + Math.max(0, rings.length - 1) * 165);
  const width = maxRadius * 2 + 360;
  const height = maxRadius * 2 + 280;
  const center = { x: width / 2, y: height / 2 };
  const nodes = rings.flatMap((ring, ringIndex) => {
    const radius = 320 + ringIndex * 165;
    return ring.map((node, index) => {
      const angle = -Math.PI / 2 + (index * Math.PI * 2 / ring.length) + (ringIndex % 2 ? Math.PI / ring.length : 0);
      return { ...node, x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius };
    });
  });
  return { width, height, nodes };
}
