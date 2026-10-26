"use client";

import { useCallback, useSyncExternalStore } from "react";
import { LayoutGrid, Rows3 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Segmented } from "./segmented";

/**
 * Any list as boxes (cards) or a table, switched by the person and remembered per list on this
 * device. One component draws both from the same rows and columns, so the two views never differ.
 */

export type ViewMode = "box" | "table";

const listeners = new Set<() => void>();
const storeKey = (key: string) => `pp:view:${key}`;
function read(key: string, fallback: ViewMode): ViewMode {
  try {
    const v = localStorage.getItem(storeKey(key));
    return v === "box" || v === "table" ? v : fallback;
  } catch {
    return fallback;
  }
}

export function useViewMode(key: string, fallback: ViewMode = "box"): [ViewMode, (v: ViewMode) => void] {
  const mode = useSyncExternalStore(
    (cb) => (listeners.add(cb), () => listeners.delete(cb)),
    () => read(key, fallback),
    () => fallback
  );
  const set = useCallback(
    (v: ViewMode) => {
      try {
        localStorage.setItem(storeKey(key), v);
      } catch {
        /* storage blocked: the choice lasts for this page only */
      }
      listeners.forEach((l) => l());
    },
    [key]
  );
  return [mode, set];
}

export function ViewToggle({ value, onChange, className }: { value: ViewMode; onChange: (v: ViewMode) => void; className?: string }) {
  return (
    <Segmented
      label="Show as"
      value={value}
      onChange={onChange}
      className={className}
      options={[
        { value: "box", label: <><LayoutGrid className="size-3.5" aria-hidden /><span className="sr-only sm:not-sr-only sm:ml-1.5">Boxes</span></> },
        { value: "table", label: <><Rows3 className="size-3.5" aria-hidden /><span className="sr-only sm:not-sr-only sm:ml-1.5">Table</span></> },
      ]}
    />
  );
}

export interface Column<T> {
  key: string;
  label: string;
  cell: (row: T) => React.ReactNode;
  /** Right-aligned numbers */
  numeric?: boolean;
  /** Left out of the box view (the box has its own title) */
  tableOnly?: boolean;
}

/**
 * The rows as boxes or a table. `box` draws one box (the columns are its lines when omitted);
 * `href` makes each row a link in both views.
 */
export function BoxTable<T>({
  rows,
  columns,
  mode,
  rowKey,
  box,
  onRow,
  label,
  boxClassName,
}: {
  rows: T[];
  columns: Column<T>[];
  mode: ViewMode;
  rowKey: (row: T) => string;
  box?: (row: T) => React.ReactNode;
  onRow?: (row: T) => void;
  label: string;
  boxClassName?: string;
}) {
  if (mode === "table") {
    return (
      <div className="overflow-x-auto rounded-card border bg-surface">
        <Table aria-label={label}>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={c.key} scope="col" className={cn(c.numeric && "text-right")}>
                  {c.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={rowKey(r)} onClick={onRow ? () => onRow(r) : undefined} className={cn(onRow && "cursor-pointer")}>
                {columns.map((c) => (
                  <TableCell key={c.key} className={cn("align-top", c.numeric && "text-right tabular")}>
                    {c.cell(r)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }
  return (
    <ul aria-label={label} className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3", boxClassName)}>
      {rows.map((r) => (
        <li key={rowKey(r)} className="min-w-0">
          {box ? (
            box(r)
          ) : (
            <div onClick={onRow ? () => onRow(r) : undefined} className={cn("flex h-full flex-col gap-1.5 rounded-card border bg-surface p-4 text-sm", onRow && "cursor-pointer hover:border-primary/40")}>
              {columns
                .filter((c) => !c.tableOnly)
                .map((c) => (
                  <div key={c.key} className="flex items-baseline justify-between gap-3">
                    <span className="shrink-0 text-xs text-muted-foreground">{c.label}</span>
                    <span className="min-w-0 truncate text-right">{c.cell(r)}</span>
                  </div>
                ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
