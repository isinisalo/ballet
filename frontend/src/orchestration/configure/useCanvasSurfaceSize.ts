import { useCallback, useEffect, useState, type RefCallback } from "react";

export interface CanvasSurfaceSize { width: number; height: number }

export function useCanvasSurfaceSize(): [RefCallback<HTMLDivElement>, CanvasSurfaceSize] {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [size, setSize] = useState<CanvasSurfaceSize>({ width: 0, height: 0 });
  const ref = useCallback<RefCallback<HTMLDivElement>>((nextNode) => setNode(nextNode), []);
  useEffect(() => {
    if (!node) return;
    const update = () => setSize((current) => current.width === node.clientWidth && current.height === node.clientHeight ? current : { width: node.clientWidth, height: node.clientHeight });
    update(); const observer = new ResizeObserver(update); observer.observe(node);
    return () => observer.disconnect();
  }, [node]);
  return [ref, size];
}
