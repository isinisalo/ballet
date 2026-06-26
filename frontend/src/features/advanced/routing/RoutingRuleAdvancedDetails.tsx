import type { ReactNode } from "react";
import { AdvancedDisclosure } from "@/components/simple-rules/AdvancedDisclosure";

export function RoutingRuleAdvancedDetails({ children }: { children: ReactNode }) {
  return (
    <AdvancedDisclosure title="Advanced details" description="Condition builders, mapping expressions, selection behavior, invalid-input behavior, priority, and dry-run output.">
      {children}
    </AdvancedDisclosure>
  );
}
