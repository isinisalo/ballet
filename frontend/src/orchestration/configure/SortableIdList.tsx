import {
  DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors,
  type DragEndEvent
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { DeleteAction } from "@/components/shared/editor-actions";
import { cn } from "@/lib/utils";

export function SortableIdList({ ariaLabel, itemLabel, ids, disabled = false, onOpen, onReorder, onDelete }: {
  ariaLabel: string;
  itemLabel: "State" | "Action";
  ids: string[];
  disabled?: boolean;
  onOpen(id: string): void;
  onReorder(ids: string[]): Promise<boolean>;
  onDelete?(id: string): Promise<void>;
}) {
  const [orderedIds, setOrderedIds] = useState(ids);
  const [pending, setPending] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const canonicalIds = useRef(ids);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  useEffect(() => { canonicalIds.current = ids; setOrderedIds(ids); }, [ids]);

  const persist = async (next: string[], movedId: string, position: number) => {
    setOrderedIds(next); setPending(true);
    const saved = await onReorder(next);
    if (!saved) setOrderedIds(canonicalIds.current);
    else setAnnouncement(`${itemLabel} ${movedId} moved to position ${position + 1} of ${next.length}.`);
    setPending(false);
  };
  const moveWithKeyboard = (id: string, delta: -1 | 1) => {
    if (pending || disabled) return;
    const from = orderedIds.indexOf(id); const to = from + delta;
    if (from < 0 || to < 0 || to >= orderedIds.length) return;
    void persist(arrayMove(orderedIds, from, to), id, to);
  };
  const finish = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id || pending || disabled) return;
    const movedId = String(active.id); const from = orderedIds.indexOf(movedId);
    const to = orderedIds.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    void persist(arrayMove(orderedIds, from, to), movedId, to);
  };

  return <>
    <p className="sr-only" aria-live="polite">{announcement}</p>
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => void finish(event)}>
      <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
        <ol aria-label={ariaLabel} className="space-y-1.5">
          {orderedIds.map((id) => <SortableIdRow key={id} id={id} itemLabel={itemLabel} disabled={disabled || pending} onOpen={onOpen} onKeyboardMove={moveWithKeyboard} onDelete={onDelete} />)}
        </ol>
      </SortableContext>
    </DndContext>
  </>;
}

function SortableIdRow({ id, itemLabel, disabled, onOpen, onKeyboardMove, onDelete }: {
  id: string; itemLabel: "State" | "Action"; disabled: boolean; onOpen(id: string): void; onKeyboardMove(id: string, delta: -1 | 1): void;
  onDelete?(id: string): Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault(); onKeyboardMove(id, event.key === "ArrowUp" ? -1 : 1); return;
    }
    listeners?.onKeyDown?.(event);
  };
  return <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
    className={cn("flex min-h-10 items-center rounded-sm border bg-card motion-reduce:transition-none", isDragging && "z-10 opacity-60 ring-2 ring-ring")}>
    <Button type="button" variant="ghost" size="icon" className="min-h-10 min-w-10 cursor-grab touch-none rounded-r-none active:cursor-grabbing"
      disabled={disabled} aria-label={`Reorder ${itemLabel} ${id}`} aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown" {...attributes} {...listeners} onKeyDown={handleKeyDown}>
      <GripVertical aria-hidden="true" />
    </Button>
    <button type="button" className="min-h-10 min-w-0 flex-1 truncate px-2 text-left font-mono text-xs text-tertiary outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      aria-label={`Open ${itemLabel} ${id}`} onClick={() => onOpen(id)}>{id}</button>
    {itemLabel === "Action" && onDelete ? <DeleteAction deleteLabel={`Delete Action ${id}`} deleteType="Action" resourceName={id} disabled={disabled} onDelete={() => onDelete(id)} /> : null}
  </li>;
}
