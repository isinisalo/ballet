import type { ReactNode } from "react";
import { AdvancedDisclosure } from "@/components/simple-rules/AdvancedDisclosure";

export function EmissionRuleAdvancedDetails({ children }: { children: ReactNode }) {
  return (
    <AdvancedDisclosure title="Advanced details" description="Condition builders, mapping expressions, subject and tag mapping, gate paths, dedupe keys, slots, and dry-run output.">
      {children}
    </AdvancedDisclosure>
  );
}
