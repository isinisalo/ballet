import { EventEmitter } from "node:events";

type RuntimeSignal = "events" | "agent-runs" | "health";

const emitter = new EventEmitter();
emitter.setMaxListeners(200);

export const notifyRuntimeChanged = (signal: RuntimeSignal): void => {
  emitter.emit("change", signal);
};

export const onRuntimeChanged = (listener: (signal: RuntimeSignal) => void): (() => void) => {
  emitter.on("change", listener);
  return () => emitter.off("change", listener);
};
