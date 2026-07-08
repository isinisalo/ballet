import { useEffect, useRef, useState, type PointerEvent } from "react";

export function useLoopCanvasInteraction({
  selectedId,
  reorderStep
}: {
  selectedId?: string;
  reorderStep: (loopId: string, fromIndex: number, toIndex: number) => void;
}) {
  const draggedStepRef = useRef<{ loopId: string; index: number } | null>(null);
  const dragStartPointRef = useRef<{ x: number; y: number } | null>(null);
  const hasDraggedStepRef = useRef(false);
  const loopCanvasRef = useRef<HTMLDivElement | null>(null);
  const [draggedStepIndex, setDraggedStepIndex] = useState<number | null>(null);
  const [dragOverStepIndex, setDragOverStepIndex] = useState<number | null>(null);
  const [canvasHeight, setCanvasHeight] = useState<number | null>(null);
  const [isCanvasPanning, setIsCanvasPanning] = useState(false);

  useEffect(() => {
    const updateCanvasHeight = () => {
      const top = loopCanvasRef.current?.getBoundingClientRect().top;
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
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-loop-step-index]");
    if (!(target instanceof HTMLElement)) return null;
    const targetIndex = Number(target.dataset.loopStepIndex);
    const loopId = target.dataset.loopId;
    if (!loopId || Number.isNaN(targetIndex)) return null;
    return { loopId, index: targetIndex };
  };

  const handleStepPointerDown = (event: PointerEvent<HTMLDivElement>, loopId: string, index: number) => {
    if (event.button !== 0) return;
    if (loopId !== selectedId) return;
    if (event.target instanceof Element && event.target.closest("button, input, select, textarea, [role='combobox']")) return;
    draggedStepRef.current = { loopId, index };
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
    if (targetStep && targetStep.loopId === draggedStep.loopId) setDragOverStepIndex(targetStep.index);
  };

  const handleStepPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const draggedStep = draggedStepRef.current;
    if (draggedStep === null) return false;
    const targetStep = stepFromPoint(event);
    const toIndex = targetStep?.loopId === draggedStep.loopId ? targetStep.index : dragOverStepIndex ?? draggedStep.index;
    const shouldActivate = !hasDraggedStepRef.current && toIndex === draggedStep.index;
    reorderStep(draggedStep.loopId, draggedStep.index, toIndex);
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
    loopCanvasRef,
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
