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
    if (event.target instanceof Element && event.target.closest("button, input, select, textarea, [role='combobox']")) return;
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
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
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
