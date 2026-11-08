"use client";

import {
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  closestCenter,
  defaultDropAnimationSideEffects,
  getFirstCollision,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type DropAnimation,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  defaultAnimateLayoutChanges,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  type AnimateLayoutChanges,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "motion/react";
import { Plus } from "lucide-react";
import { statusColor } from "@/lib/status-colors";
import { cn } from "@/lib/utils";
import { JobCard } from "./job-card";
import { groupIds, type Job, type Status } from "./utils";

export type MoveHandler = (
  jobId: string,
  toStatusId: string,
  beforeId: string | null,
  afterId: string | null,
) => void;

type Props = {
  statuses: Status[];
  jobs: Job[];
  onMove: MoveHandler;
  onOpen: (jobId: string) => void;
  onAdd: (statusId: string) => void;
};

type Columns = Record<string, string[]>;

/** One ease for every step (no overshoot), matching the app's motion tokens. */
const EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)";
const SLIDE_MS = 240;

const dropAnimation: DropAnimation = {
  duration: SLIDE_MS,
  easing: EASE,
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: "0" } },
  }),
};

export function BoardView({ statuses, jobs, onMove, onOpen, onAdd }: Props) {
  // Stable id keeps dnd-kit's aria-describedby ids identical on server and client.
  const dndId = useId();
  const base = useMemo(() => groupIds(statuses, jobs), [statuses, jobs]);
  const jobById = useMemo(() => new Map(jobs.map((j) => [j.id, j])), [jobs]);
  const [drag, setDrag] = useState<Columns | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const columns = drag ?? base;

  // Multi-column pattern from dnd-kit: remember the last target and ignore the
  // collision flicker right after a card changes column, so it doesn't bounce.
  const lastOverId = useRef<UniqueIdentifier | null>(null);
  const movedToNewColumn = useRef(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      movedToNewColumn.current = false;
    });
    return () => cancelAnimationFrame(raf);
  }, [columns]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    // Space picks up / drops; Enter is left free to open the job.
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] },
    }),
  );

  const findColumn = useCallback((id: UniqueIdentifier, cols: Columns) => {
    const key = String(id);
    return key in cols
      ? key
      : Object.keys(cols).find((k) => cols[k].includes(key));
  }, []);

  const collisionDetection: CollisionDetection = useCallback(
    (args) => {
      // Pointer first (precise), then rectangle overlap as a fallback.
      const pointer = pointerWithin(args);
      const hits = pointer.length > 0 ? pointer : rectIntersection(args);
      let overId = getFirstCollision(hits, "id");

      if (overId != null) {
        // Over a column: target the closest card inside it, if it has any.
        if (String(overId) in columns) {
          const items = columns[String(overId)];
          if (items.length > 0) {
            overId =
              closestCenter({
                ...args,
                droppableContainers: args.droppableContainers.filter(
                  (c) => c.id !== overId && items.includes(String(c.id)),
                ),
              })[0]?.id ?? overId;
          }
        }
        lastOverId.current = overId;
        return [{ id: overId }];
      }

      if (movedToNewColumn.current) lastOverId.current = activeId;
      return lastOverId.current ? [{ id: lastOverId.current }] : [];
    },
    [activeId, columns],
  );

  function onDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id));
    setDrag(structuredClone(base));
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over || !drag) return;
    const from = findColumn(active.id, drag);
    const to = findColumn(over.id, drag);
    if (!from || !to || from === to) return;

    setDrag((cols) => {
      if (!cols) return cols;
      const toItems = cols[to];
      const overIndex = toItems.indexOf(String(over.id));
      // Insert below the hovered card when the pointer is past its middle.
      const translated = active.rect.current.translated;
      const below =
        overIndex >= 0 &&
        translated &&
        translated.top > over.rect.top + over.rect.height / 2;
      const index =
        overIndex >= 0 ? overIndex + (below ? 1 : 0) : toItems.length;

      movedToNewColumn.current = true;
      return {
        ...cols,
        [from]: cols[from].filter((id) => id !== active.id),
        [to]: [
          ...toItems.slice(0, index),
          String(active.id),
          ...toItems.slice(index),
        ],
      };
    });
  }

  function reset() {
    setDrag(null);
    setActiveId(null);
    lastOverId.current = null;
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    const id = String(active.id);
    if (!over || !drag) return reset();
    const to = findColumn(over.id, drag);
    if (!to) return reset();

    let items = drag[to];
    const oldIndex = items.indexOf(id);
    const overIndex = items.indexOf(String(over.id));
    if (oldIndex >= 0 && overIndex >= 0 && oldIndex !== overIndex)
      items = arrayMove(items, oldIndex, overIndex);

    const index = items.indexOf(id);
    const unchanged =
      jobById.get(id)?.statusId === to && base[to].indexOf(id) === index;
    reset();
    if (unchanged || index < 0) return;
    onMove(id, to, items[index - 1] ?? null, items[index + 1] ?? null);
  }

  const activeJob = activeId ? jobById.get(activeId) : undefined;

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={collisionDetection}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={reset}
    >
      <div className="scrollbar-thin flex h-full gap-3 overflow-x-auto px-4 pb-4 sm:px-6">
        {statuses.map((status) => (
          <Column
            key={status.id}
            status={status}
            ids={columns[status.id] ?? []}
            jobById={jobById}
            activeId={activeId}
            onOpen={onOpen}
            onAdd={onAdd}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={dropAnimation}>
        {activeJob ? (
          // Lifts smoothly instead of snapping: a soft rise and a deeper shadow, no tilt.
          <motion.div
            initial={{
              scale: 1,
              y: 0,
              boxShadow: "0 1px 2px rgb(0 0 0 / 0.06)",
            }}
            animate={{
              scale: 1.02,
              y: -2,
              boxShadow: "0 18px 40px -12px rgb(0 0 0 / 0.28)",
            }}
            transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            className="rounded-xl"
          >
            <JobCard job={activeJob} overlay />
          </motion.div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

const Column = memo(function Column({
  status,
  ids,
  jobById,
  activeId,
  onOpen,
  onAdd,
}: {
  status: Status;
  ids: string[];
  jobById: Map<string, Job>;
  activeId: string | null;
  onOpen: (id: string) => void;
  onAdd: (statusId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id });
  const color = statusColor(status.color);
  const empty = ids.length === 0;

  return (
    <section
      className={cn(
        "flex w-[18.5rem] shrink-0 flex-col rounded-2xl border border-transparent bg-muted/45",
        "transition-[background-color,border-color] duration-200 ease-[cubic-bezier(.2,.8,.2,1)]",
        isOver && activeId && "border-border bg-muted/80",
      )}
      aria-label={`${status.name} column`}
    >
      <header className="group/col flex h-11 items-center gap-2 px-3">
        <span className={cn("size-2 rounded-full", color.dot)} aria-hidden />
        <h2 className="text-[13px] font-medium tracking-tight">
          {status.name}
        </h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {ids.length}
        </span>
        <button
          type="button"
          onClick={() => onAdd(status.id)}
          aria-label={`Add job to ${status.name}`}
          className="ml-auto grid size-6 place-items-center rounded-md text-muted-foreground opacity-0 transition-[opacity,background-color,color] duration-150 group-hover/col:opacity-100 hover:bg-background hover:text-foreground focus-visible:opacity-100"
        >
          <Plus className="size-3.5" />
        </button>
      </header>
      <div
        ref={setNodeRef}
        className="scrollbar-thin relative flex min-h-28 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2"
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {ids.map((id) => {
            const job = jobById.get(id);
            return job ? (
              <SortableCard
                key={id}
                job={job}
                isActive={id === activeId}
                onOpen={onOpen}
              />
            ) : null;
          })}
        </SortableContext>
        {/* Absolutely placed, so cards entering an empty column never shift the layout. */}
        <button
          type="button"
          onClick={() => onAdd(status.id)}
          tabIndex={empty ? 0 : -1}
          aria-hidden={!empty}
          className={cn(
            "absolute inset-x-2 top-0 bottom-2 grid place-items-center rounded-xl border border-dashed text-xs text-muted-foreground",
            "transition-[opacity,border-color,color] duration-200 hover:border-foreground/25 hover:text-foreground",
            empty ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          {isOver && activeId ? "Drop to move here" : "No jobs yet"}
        </button>
      </div>
    </section>
  );
});

// Animate neighbours when the list changes mid-drag (e.g. a card arriving from another column).
const animateLayoutChanges: AnimateLayoutChanges = (args) =>
  defaultAnimateLayoutChanges({ ...args, wasDragging: true });

const SortableCard = memo(function SortableCard({
  job,
  isActive,
  onOpen,
}: {
  job: Job;
  isActive: boolean;
  onOpen: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: job.id,
      animateLayoutChanges,
      transition: { duration: SLIDE_MS, easing: EASE },
    });
  return (
    <JobCard
      ref={setNodeRef}
      job={job}
      placeholder={isActive}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(job.id)}
      onKeyDown={(e) => {
        listeners?.onKeyDown?.(e);
        if (e.key === "Enter" && !e.defaultPrevented) onOpen(job.id);
      }}
    />
  );
});
