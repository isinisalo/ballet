import { useEffect } from "react";
import { subscribeInvalidations, type InvalidationListener } from "./invalidationStream";

export function useOrchestrationInvalidations(refresh: InvalidationListener) {
  useEffect(() => subscribeInvalidations(refresh), [refresh]);
}
