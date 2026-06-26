import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function CheckboxLike({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <Button type="button" variant={checked ? "default" : "outline"} className="justify-start" aria-pressed={checked} onClick={() => onChange(!checked)}>
        <Check className={checked ? "size-4 opacity-100" : "size-4 opacity-20"} />
        {checked ? "Yes" : "No"}
      </Button>
    </div>
  );
}
