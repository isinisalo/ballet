import { useEffect, useRef, useState, type PointerEvent } from "react";

export function useWorkflowCanvasInteraction({
  selectedId,
  reorderStep
}: {
  selectedId?: string;
  reorderStep: (workflowId: string, fromIndex: number, toIndex: number) => void;
}) {
  const draggedStepRef = useRef<{ workflowId: string; index: number } | null>(null);
  const dragStartPointRef = useRef<{ x: number; y: number } | null>(null);
  const hasDraggedStepRef = useRef(false);
  const workflowCanvasRef = useRef<HTMLDivElement | null>(null);
  const [draggedStepIndex, setDraggedStepIndex] = useState<number | null>(null);
  const [dragOverStepIndex, setDragOverStepIndex] = useState<number | null>(null);
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
    draggedStepRef.current = null;
    dragStartPointRef.current = null;
    hasDraggedStepRef.current = false;
    setDraggedStepIndex(null);
    setDragOverStepIndex(null);
  };

  const stepFromPoint = (event: PointerEvent<HTMLDivElement>) => {
    if (typeof document.elementFromPoint !== "function") return null;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-workflow-step-index]");
    if (!(target instanceof HTMLElement)) return null;
    const targetIndex = Number(target.dataset.workflowStepIndex);
    const workflowId = target.dataset.workflowId;
    if (!workflowId || Number.isNaN(targetIndex)) return null;
    return { workflowId, index: targetIndex };
  };

  const handleStepPointerDown = (event: PointerEvent<HTMLDivElement>, workflowId: string, index: number) => {
    if (event.button !== 0) return;
    if (workflowId !== selectedId) return;
    if (event.target instanceof Element && event.target.closest("button, input, select, textarea, [role='combobox']")) return;
    draggedStepRef.current = { workflowId, index };
    dragStartPointRef.current = { x: event.clientX, y: event.clientY };
    hasDraggedStepRef.current = false;
    setDraggedStepIndex(index);
    setDragOverStepIndex(index);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleStepPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const draggedStep = draggedStepRef.current;
    if (draggedStep === null) return;
    const startPoint = dragStartPointRef.current;
    if (startPoint && Math.hypot(event.clientX - startPoint.x, event.clientY - startPoint.y) > 4) {
      hasDraggedStepRef.current = true;
    }
    const targetStep = stepFromPoint(event);
    if (targetStep && targetStep.workflowId === draggedStep.workflowId) setDragOverStepIndex(targetStep.index);
  };

  const handleStepPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const draggedStep = draggedStepRef.current;
    if (draggedStep === null) return false;
    const targetStep = stepFromPoint(event);
    const toIndex = targetStep?.workflowId === draggedStep.workflowId ? targetStep.index : dragOverStepIndex ?? draggedStep.index;
    const shouldActivate = !hasDraggedStepRef.current && toIndex === draggedStep.index;
    reorderStep(draggedStep.workflowId, draggedStep.index, toIndex);
    resetStepDrag();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    return shouldActivate;
  };

  const handleCanvasMoveStart = () => {
    setIsCanvasPanning(true);
  };

  const handleCanvasMoveEnd = () => {
    setIsCanvasPanning(false);
  };

  return {
    workflowCanvasRef,
    draggedStepIndex,
    dragOverStepIndex,
    canvasHeight,
    isCanvasPanning,
    handleStepPointerDown,
    handleStepPointerMove,
    handleStepPointerUp,
    resetStepDrag,
    handleCanvasMoveStart,
    handleCanvasMoveEnd
  };
}
