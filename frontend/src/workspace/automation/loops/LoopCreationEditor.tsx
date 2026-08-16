import type { ComponentProps } from "react";
import { LoopEditor } from "./LoopEditor";

export function LoopCreationEditor(props: Omit<ComponentProps<typeof LoopEditor>, "locked">) {
  return <LoopEditor {...props} locked={false} />;
}
