import { useEffect, useRef, useState, type PointerEvent } from "react";

export function useWorkflowCanvasInteraction({
  selectedId,
  reorderStep
}: {
  selectedId?: string;
  reorderStep: (fromIndex: number, toIndex: number) => void;
}) {
  const draggedStepIndexRef = useRef<number | null>(null);
  const workflowCanvasRef = useRef<HTMLDivElement | null>(null);
  const canvasPanRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const [draggedStepIndex, setDraggedStepIndex] = useState<number | null>(null);
  const [dragOverStepIndex, setDragOverStepIndex] = useState<number | null>(null);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [canvasHeight, setCanvasHeight] = useState<number | null>(null);
  const [isCanvasPanning, setIsCanvasPanning] = useState(false);

  useEffect(() => {
    const updateCanvasHeight = () => {
      const top = workflowCanvasRef.current?.getBoundingClientRect().top;
      if (typeof top !== "number") return;
      setCanvasHeight(Math.max(448, window.innerHeight - top - 24));
    };

    updateCanvasHeight();
    const frame = window.requestAnimationFrame(updateCanvasHeight);
    const timeout = window.setTimeout(updateCanvasHeight, 0);
    window.addEventListener("resize", updateCanvasHeight);
    document.addEventListener("scroll", updateCanvasHeight, true);
    window.visualViewport?.addEventListener("resize", updateCanvasHeight);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
      window.removeEventListener("resize", updateCanvasHeight);
      document.removeEventListener("scroll", updateCanvasHeight, true);
      window.visualViewport?.removeEventListener("resize", updateCanvasHeight);
    };
  }, [selectedId]);

  const resetStepDrag = () => {
    draggedStepIndexRef.current = null;
    setDraggedStepIndex(null);
    setDragOverStepIndex(null);
  };

  const stepIndexFromPoint = (event: PointerEvent<HTMLDivElement>) => {
    if (typeof document.elementFromPoint !== "function") return null;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-workflow-step-index]");
    if (!(target instanceof HTMLElement)) return null;
    const targetIndex = Number(target.dataset.workflowStepIndex);
    return Number.isNaN(targetIndex) ? null : targetIndex;
  };

  const handleStepPointerDown = (event: PointerEvent<HTMLDivElement>, index: number) => {
    if (event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest("button, [role='combobox']")) return;
    draggedStepIndexRef.current = index;
    setDraggedStepIndex(index);
    setDragOverStepIndex(index);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleStepPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (draggedStepIndexRef.current === null) return;
    const targetIndex = stepIndexFromPoint(event);
    if (targetIndex !== null) setDragOverStepIndex(targetIndex);
  };

  const handleStepPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const fromIndex = draggedStepIndexRef.current;
    if (fromIndex === null) return;
    const toIndex = stepIndexFromPoint(event) ?? dragOverStepIndex ?? fromIndex;
    reorderStep(fromIndex, toIndex);
    resetStepDrag();
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const resetCanvasPan = () => {
    canvasPanRef.current = null;
    setIsCanvasPanning(false);
  };

  const handleCanvasPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest("[data-workflow-node], button, [role='combobox']")) return;
    canvasPanRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: canvasOffset.x,
      originY: canvasOffset.y
    };
    setIsCanvasPanning(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleCanvasPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const pan = canvasPanRef.current;
    if (!pan) return;
    setCanvasOffset({
      x: pan.originX + event.clientX - pan.startX,
      y: pan.originY + event.clientY - pan.startY
    });
  };

  const handleCanvasPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!canvasPanRef.current) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    resetCanvasPan();
  };

  return {
    workflowCanvasRef,
    draggedStepIndex,
    dragOverStepIndex,
    canvasOffset,
    canvasHeight,
    isCanvasPanning,
    handleStepPointerDown,
    handleStepPointerMove,
    handleStepPointerUp,
    resetStepDrag,
    handleCanvasPointerDown,
    handleCanvasPointerMove,
    handleCanvasPointerUp,
    resetCanvasPan
  };
}
