import type { ReactNode } from "react";
import { AdvancedDisclosure } from "@/components/simple-rules/AdvancedDisclosure";

export function FlowBoundaryAdvancedDetails({ children }: { children: ReactNode }) {
  return (
    <AdvancedDisclosure title="Advanced details" description="Loop id, version, raw routing and emission policy IDs, and the canonical LoopDefinition source.">
      {children}
    </AdvancedDisclosure>
  );
}
