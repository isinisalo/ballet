import { eventTypeFromLoopId } from "@shared/policy-actions";
import type { LoopHandlerRoute } from "./LoopHandlerSheet";
import type { LoopStepRecord } from "./loopGraph";

export type PendingLoopHandlerOutput = {
  eventType: string;
  sourceActionId: string;
  sourceLabel: string;
  outputId: string;
};

export function loopHandlerRoute(record: LoopStepRecord): LoopHandlerRoute | undefined {
  if (!record.action) return undefined;
  const eventParts = loopEventParts(record.outputEvents?.[0] ?? eventTypeFromLoopId(record.loopId ?? ""));

  return {
    id: `${record.loopId ?? "loop"}-${record.index}-${record.actionId}`,
    loopId: record.loopId ?? "",
    stepIndex: record.index,
    actionId: record.actionId,
    sourceLabel: eventParts?.sourceLabel ?? "Missing event",
    outputId: eventParts?.outputId,
    eventType: record.outputEvents?.[0],
    actionLabel: record.action.id
  };
}

export function pendingLoopHandlerRoute(loopId: string, stepIndex: number, pendingOutput: PendingLoopHandlerOutput): LoopHandlerRoute {
  return {
    id: `${loopId}-${stepIndex}-pending-${pendingOutput.sourceActionId}-${pendingOutput.outputId}`,
    loopId,
    stepIndex,
    actionId: "",
    sourceLabel: pendingOutput.sourceLabel,
    outputId: pendingOutput.outputId,
    eventType: pendingOutput.eventType,
    actionLabel: ""
  };
}

export function loopEventParts(eventType: string | undefined) {
  if (!eventType) return undefined;
  const separatorIndex = eventType.lastIndexOf(".");
  if (separatorIndex < 0) return { sourceLabel: eventType };
  return {
    sourceLabel: eventType.slice(0, separatorIndex) || eventType,
    outputId: eventType.slice(separatorIndex + 1) || undefined
  };
}
