import type { ReactNode } from "react";

export function FlowBranchGroup({ children }: { children: ReactNode }) {
  return <div className="contents">{children}</div>;
}
