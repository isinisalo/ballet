import { OperationalStatus } from "@/components/shared/workspace-ui";
import { statusPresentation } from "../runModels";

export function StatusLabel({ status }: { status: string }) { const value = statusPresentation(status); return <OperationalStatus label={value.label} tone={value.tone} />; }
