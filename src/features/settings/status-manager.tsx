"use client";

import { useId, useState, useTransition } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  STATUS_COLORS,
  statusColor,
  type StatusColor,
} from "@/lib/status-colors";
import { cn } from "@/lib/utils";
import type { Status } from "@/server/db/schema";
import {
  createStatus,
  deleteStatus,
  reorderStatuses,
  statusJobCounts,
  updateStatus,
} from "@/server/jobs/status-actions";
import { StatusSelect } from "@/features/jobs/status-select";

const KINDS = [
  { value: "open", label: "In progress" },
  { value: "won", label: "Offer (won)" },
  { value: "lost", label: "Closed (lost)" },
];

export function StatusManager({ statuses: initial }: { statuses: Status[] }) {
  const dndId = useId();
  const [items, setItems] = useState(initial);
  const [syncedFrom, setSyncedFrom] = useState(initial);
  if (initial !== syncedFrom) {
    setSyncedFrom(initial);
    setItems(initial);
  }
  const [deleting, setDeleting] = useState<{
    status: Status;
    count: number;
  } | null>(null);
  const [adding, startAdd] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  async function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((s) => s.id === active.id);
    const to = items.findIndex((s) => s.id === over.id);
    const snapshot = items;
    const next = arrayMove(items, from, to);
    setItems(next);
    const res = await reorderStatuses(next.map((s) => s.id));
    if (!res.ok) {
      setItems(snapshot);
      toast.error(res.error);
    }
  }

  async function save(
    s: Status,
    patch: Partial<Pick<Status, "name" | "color" | "kind">>,
  ) {
    const next = { ...s, ...patch };
    if (next.name.trim() === "") return toast.error("Name the stage");
    setItems((all) => all.map((x) => (x.id === s.id ? next : x)));
    const res = await updateStatus(s.id, {
      name: next.name,
      color: next.color,
      kind: next.kind,
    });
    if (!res.ok) {
      setItems((all) => all.map((x) => (x.id === s.id ? s : x)));
      toast.error(res.error);
    }
  }

  async function askDelete(s: Status) {
    const counts = await statusJobCounts();
    setDeleting({ status: s, count: counts[s.id] ?? 0 });
  }

  function add() {
    const used = new Set(items.map((s) => s.color));
    const color =
      (Object.keys(STATUS_COLORS) as StatusColor[]).find((c) => !used.has(c)) ??
      "slate";
    startAdd(async () => {
      const res = await createStatus({
        name: "New stage",
        color,
        kind: "open",
      });
      if (!res.ok) toast.error(res.error);
    });
  }

  return (
    <>
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={items.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="divide-y rounded-xl border">
            {items.map((s) => (
              <StatusRow
                key={s.id}
                status={s}
                canDelete={items.length > 2}
                onSave={(patch) => save(s, patch)}
                onDelete={() => askDelete(s)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <Button
        variant="outline"
        className="mt-3"
        onClick={add}
        disabled={adding || items.length >= 12}
      >
        {adding ? <Loader2 className="animate-spin" /> : <Plus />}
        Add stage
      </Button>

      {deleting && (
        <DeleteStageDialog
          key={deleting.status.id}
          status={deleting.status}
          count={deleting.count}
          others={items.filter((s) => s.id !== deleting.status.id)}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  );
}

function StatusRow({
  status,
  canDelete,
  onSave,
  onDelete,
}: {
  status: Status;
  canDelete: boolean;
  onSave: (patch: Partial<Pick<Status, "name" | "color" | "kind">>) => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: status.id,
    transition: { duration: 240, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
  });
  const [name, setName] = useState(status.name);
  const [syncedName, setSyncedName] = useState(status.name);
  if (status.name !== syncedName) {
    setSyncedName(status.name);
    setName(status.name);
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "relative flex items-center gap-2 bg-card px-2 py-2 first:rounded-t-xl last:rounded-b-xl sm:gap-3",
        isDragging && "z-10 shadow-lg ring-1 ring-border",
      )}
    >
      <button
        type="button"
        className="grid size-8 shrink-0 cursor-grab place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface hover:text-foreground active:cursor-grabbing"
        aria-label={`Reorder ${status.name}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>

      <Popover>
        <PopoverTrigger
          className="grid size-8 shrink-0 place-items-center rounded-md transition-colors hover:bg-surface"
          aria-label={`Colour for ${status.name}`}
        >
          <span
            className={cn("size-3 rounded-full", statusColor(status.color).dot)}
          />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2">
          <div className="grid grid-cols-4 gap-1">
            {(Object.keys(STATUS_COLORS) as StatusColor[]).map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                aria-pressed={statusColor(status.color) === STATUS_COLORS[c]}
                onClick={() => onSave({ color: c })}
                className={cn(
                  "grid size-8 place-items-center rounded-md transition-colors hover:bg-surface",
                  statusColor(status.color) === STATUS_COLORS[c] &&
                    "bg-surface ring-1 ring-border",
                )}
              >
                <span
                  className={cn("size-3 rounded-full", STATUS_COLORS[c].dot)}
                />
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <Input
        value={name}
        maxLength={32}
        aria-label="Stage name"
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name !== status.name && onSave({ name })}
        onKeyDown={(e) =>
          e.key === "Enter" && (e.target as HTMLInputElement).blur()
        }
        className="h-8 min-w-0 flex-1 border-transparent bg-transparent shadow-none hover:border-border focus-visible:border-ring dark:bg-transparent"
      />

      <Select
        items={KINDS}
        value={status.kind}
        onValueChange={(v) => v && onSave({ kind: v as Status["kind"] })}
      >
        <SelectTrigger
          size="sm"
          className="w-36 max-sm:hidden"
          aria-label="Stage type"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {KINDS.map((k) => (
            <SelectItem key={k.value} value={k.value}>
              {k.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Delete ${status.name}`}
        disabled={!canDelete}
        onClick={onDelete}
        className="text-muted-foreground hover:text-destructive"
      >
        <Trash2 />
      </Button>
    </li>
  );
}

function DeleteStageDialog({
  status,
  count,
  others,
  onClose,
}: {
  status: Status;
  count: number;
  others: Status[];
  onClose: () => void;
}) {
  // Default to a stage of the same type (Ghosted → Rejected), else the first.
  const [moveTo, setMoveTo] = useState(
    (others.find((s) => s.kind === status.kind) ?? others[0])?.id ?? "",
  );
  const [pending, start] = useTransition();

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete “{status.name}”?</DialogTitle>
          <DialogDescription>
            {count === 0
              ? "No jobs are in this stage, so nothing else changes."
              : `${count} ${count === 1 ? "job is" : "jobs are"} in this stage. Choose where to move ${count === 1 ? "it" : "them"}; each move is added to the job's timeline.`}
          </DialogDescription>
        </DialogHeader>
        {count > 0 && (
          <label className="block space-y-1.5">
            <span className="block text-xs font-medium text-muted-foreground">
              Move jobs to
            </span>
            <StatusSelect
              className="w-full"
              statuses={others}
              value={moveTo}
              onChange={setMoveTo}
            />
          </label>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={pending || (count > 0 && !moveTo)}
            onClick={() =>
              start(async () => {
                const res = await deleteStatus(
                  status.id,
                  count > 0 ? moveTo : undefined,
                );
                if (!res.ok) return void toast.error(res.error);
                toast(`Deleted “${status.name}”`);
                onClose();
              })
            }
          >
            {pending && <Loader2 className="animate-spin" />}
            Delete stage
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
