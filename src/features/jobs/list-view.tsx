"use client";

import { useMemo } from "react";
import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_datetime,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp } from "lucide-react";
import { RelativeTime } from "@/components/relative-time";
import { cn } from "@/lib/utils";
import { CompanyMark, PriorityBars } from "./job-card";
import { StatusSelect } from "./status-select";
import {
  PRIORITY_META,
  WORK_MODE_LABEL,
  formatSalary,
  type Job,
  type Status,
} from "./utils";

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, datetime: sortFn_datetime },
});
const helper = createColumnHelper<typeof features, Job>();
const PRIORITY_RANK = { low: 0, medium: 1, high: 2 } as const;

export function ListView({
  statuses,
  jobs,
  onOpen,
  onStatusChange,
}: {
  statuses: Status[];
  jobs: Job[];
  onOpen: (id: string) => void;
  onStatusChange: (jobId: string, statusId: string) => void;
}) {
  const statusOrder = useMemo(
    () => new Map(statuses.map((s) => [s.id, s.position])),
    [statuses],
  );

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("company", {
          header: "Role",
          sortFn: "alphanumeric",
          cell: (info) => {
            const job = info.row.original;
            return (
              <div className="flex min-w-0 items-center gap-3">
                <CompanyMark company={job.company} className="size-8 text-xs" />
                <div className="min-w-0">
                  <p className="truncate font-medium tracking-[-0.01em]">
                    {job.title}
                  </p>
                  <p className="truncate text-[13px] text-muted-foreground">
                    {job.company}
                  </p>
                </div>
              </div>
            );
          },
        }),
        helper.accessor("statusId", {
          header: "Status",
          sortFn: (a, b) =>
            (statusOrder.get(a.original.statusId) ?? 0) -
            (statusOrder.get(b.original.statusId) ?? 0),
          cell: (info) => (
            <StatusSelect
              size="sm"
              variant="ghost"
              statuses={statuses}
              value={info.getValue()}
              onChange={(s) => onStatusChange(info.row.original.id, s)}
            />
          ),
        }),
        helper.accessor("priority", {
          header: "Priority",
          sortFn: (a, b) =>
            PRIORITY_RANK[a.original.priority] -
            PRIORITY_RANK[b.original.priority],
          cell: (info) => (
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <PriorityBars priority={info.getValue()} />
              {PRIORITY_META[info.getValue()].label}
            </span>
          ),
        }),
        helper.accessor("location", {
          header: "Location",
          sortFn: "alphanumeric",
          sortUndefined: "last",
          cell: (info) => {
            const job = info.row.original;
            const text = [
              job.location,
              job.workMode && WORK_MODE_LABEL[job.workMode],
            ]
              .filter(Boolean)
              .join(" · ");
            return <span className="text-muted-foreground">{text || "—"}</span>;
          },
        }),
        helper.accessor("salaryMax", {
          header: "Salary",
          sortUndefined: "last",
          cell: (info) => (
            <span className="font-mono text-[13px] text-muted-foreground">
              {formatSalary(info.row.original) ?? "—"}
            </span>
          ),
        }),
        helper.accessor("updatedAt", {
          header: "Updated",
          sortFn: "datetime",
          cell: (info) => (
            <RelativeTime
              date={info.getValue()}
              className="text-muted-foreground"
            />
          ),
        }),
      ]),
    [statuses, statusOrder, onStatusChange],
  );

  const table = useTable({
    features,
    columns,
    data: jobs,
    getRowId: (row) => row.id,
    initialState: { sorting: [{ id: "updatedAt", desc: true }] },
  });

  return (
    <div className="px-4 pb-6 sm:px-6">
      <div className="scrollbar-thin overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id} className="border-b">
                {group.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      aria-sort={
                        sorted === "asc"
                          ? "ascending"
                          : sorted === "desc"
                            ? "descending"
                            : "none"
                      }
                      className="h-10 px-4 text-left text-[13px] font-normal text-muted-foreground"
                    >
                      <button
                        onClick={header.column.getToggleSortingHandler()}
                        className={cn(
                          "group/sort inline-flex items-center gap-1 rounded transition-colors duration-150 hover:text-foreground",
                          sorted && "text-foreground",
                        )}
                      >
                        <table.FlexRender header={header} />
                        {sorted === "asc" ? (
                          <ArrowUp className="size-3" />
                        ) : sorted === "desc" ? (
                          <ArrowDown className="size-3" />
                        ) : (
                          <ArrowDown className="size-3 opacity-0 transition-opacity group-hover/sort:opacity-40" />
                        )}
                      </button>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                tabIndex={0}
                onClick={() => onOpen(row.original.id)}
                onKeyDown={(e) => e.key === "Enter" && onOpen(row.original.id)}
                className="cursor-pointer border-b transition-colors duration-150 outline-none last:border-0 hover:bg-surface focus-visible:bg-surface"
              >
                {row.getAllCells().map((cell) => (
                  <td key={cell.id} className="h-14 max-w-72 px-4">
                    <table.FlexRender cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {jobs.length === 0 && (
          <p className="p-12 text-center text-sm text-muted-foreground">
            No jobs match your search.
          </p>
        )}
      </div>
    </div>
  );
}
