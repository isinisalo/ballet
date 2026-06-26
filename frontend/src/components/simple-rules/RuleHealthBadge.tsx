import { Badge } from "@/components/ui/badge";

export type RuleHealth = "ready" | "warning" | "invalid";

export function RuleHealthBadge({ health }: { health: RuleHealth }) {
  if (health === "invalid") return <Badge variant="destructive">Invalid</Badge>;
  if (health === "warning") return <Badge variant="outline">Needs attention</Badge>;
  return <Badge variant="default">Ready</Badge>;
}
