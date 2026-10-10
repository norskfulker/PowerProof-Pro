"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Columns3, Download, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ErrorState } from "./empty-state";

export interface TableFilter {
  columnId: string;
  label: string;
  options: { value: string; label: string }[];
}

/** A number above the table, worked out from the rows that match the search and filters */
export interface TableStat {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
}

/** One column of the CSV export */
export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | undefined | null;
}

interface ColumnMeta {
  align?: "right";
  /** The column's name in the Columns menu, when its header isn't plain text */
  label?: string;
}

const RANGES = [
  { value: "all", label: "All time", days: 0 },
  { value: "today", label: "Today", days: 1 },
  { value: "7", label: "Last 7 days", days: 7 },
  { value: "30", label: "Last 30 days", days: 30 },
  { value: "90", label: "Last 90 days", days: 90 },
  { value: "365", label: "Last 12 months", days: 365 },
] as const;

const PAGE_SIZES = [10, 25, 50, 100];

function sinceOf(range: string): number | undefined {
  const r = RANGES.find((x) => x.value === range);
  if (!r || !r.days) return undefined;
  if (r.value === "today") {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  return Date.now() - r.days * 86_400_000;
}

function downloadCsv<T>(rows: T[], columns: CsvColumn<T>[], filename: string) {
  const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const text = [columns.map((c) => cell(c.header)).join(","), ...rows.map((r) => columns.map((c) => cell(c.value(r))).join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Which columns a creator hid, per table, on this device */
const HIDDEN_EVENT = "pp:table-columns";
const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  window.addEventListener(HIDDEN_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(HIDDEN_EVENT, cb);
  };
};
/** Choices this visit, for when the browser won't store them */
const memory = new Map<string, string>();
function readSaved(key: string): string {
  try {
    return localStorage.getItem(key) ?? memory.get(key) ?? "";
  } catch {
    return memory.get(key) ?? "";
  }
}

function useHidden(key: string, defaults: string[]): [VisibilityState, (v: VisibilityState) => void] {
  const raw = useSyncExternalStore(subscribe, () => readSaved(key), () => "");
  const defaultsKey = defaults.join(",");
  const state = useMemo<VisibilityState>(() => {
    const initial = Object.fromEntries(defaultsKey.split(",").filter(Boolean).map((id) => [id, false]));
    try {
      return raw ? { ...initial, ...(JSON.parse(raw) as VisibilityState) } : initial;
    } catch {
      return initial;
    }
  }, [raw, defaultsKey]);
  const set = (v: VisibilityState) => {
    memory.set(key, JSON.stringify(v));
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {
      /* private window or blocked storage: not remembered */
    }
    window.dispatchEvent(new Event(HIDDEN_EVENT));
  };
  return [state, set];
}

export function DataTable<T>({
  columns,
  data,
  loading,
  error,
  onRetry,
  searchPlaceholder = "Search",
  filters = [],
  initialFilters = [],
  empty,
  noResults = "Nothing matches. Try a different search or clear filters.",
  rowHref,
  mobileCard,
  pageSize = 25,
  label,
  toolbar,
  initialSearch = "",
  dateFilter,
  summary,
  csv,
  selectable,
  bulkActions,
  defaultHidden = [],
  rowId,
}: {
  /** Pre-fills the search box, e.g. from ?q= in a link */
  initialSearch?: string;
  columns: ColumnDef<T, unknown>[];
  data: T[] | undefined;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  searchPlaceholder?: string;
  filters?: TableFilter[];
  initialFilters?: ColumnFiltersState;
  /** Shown when there's no data at all. */
  empty?: React.ReactNode;
  noResults?: string;
  rowHref?: (row: T) => string;
  /** Card layout under 768px. */
  mobileCard?: (row: T) => React.ReactNode;
  pageSize?: number;
  /** Accessible table name; also keys the remembered column choices */
  label: string;
  toolbar?: React.ReactNode;
  /** A period picker (Today, 7 days…) over this date */
  dateFilter?: { get: (row: T) => string | undefined; label?: string };
  /** Numbers above the table for the matching rows */
  summary?: (rows: T[]) => TableStat[];
  /** An Export CSV button: the matching rows, or the selected ones */
  csv?: { filename: string; columns: CsvColumn<T>[] };
  /** Tick rows to act on several at once */
  selectable?: boolean;
  /** Buttons for the ticked rows; call clear() when done */
  bulkActions?: (rows: T[], clear: () => void) => React.ReactNode;
  /** Columns hidden until the creator shows them */
  defaultHidden?: string[];
  /** A stable id per row, so ticks survive a reload of the data */
  rowId?: (row: T) => string;
}) {
  const router = useRouter();
  const [globalFilter, setGlobalFilter] = useState(initialSearch);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(initialFilters);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [range, setRange] = useState("all");
  const [visibility, setVisibility] = useHidden(`pp:table:${label}`, defaultHidden);

  const rowsIn = useMemo(() => {
    const since = dateFilter ? sinceOf(range) : undefined;
    if (!since || !data) return data ?? [];
    return data.filter((r) => {
      const d = dateFilter?.get(r);
      return d ? Date.parse(d) >= since : false;
    });
  }, [data, range, dateFilter]);

  const allColumns = useMemo<ColumnDef<T, unknown>[]>(
    () =>
      selectable
        ? [
            {
              id: "_select",
              enableHiding: false,
              header: ({ table }) => (
                <Checkbox
                  aria-label="Select all on this page"
                  checked={table.getIsAllPageRowsSelected() ? true : table.getIsSomePageRowsSelected() ? "indeterminate" : false}
                  onCheckedChange={(v) => table.toggleAllPageRowsSelected(v === true)}
                />
              ),
              cell: ({ row }) => <Checkbox aria-label="Select row" checked={row.getIsSelected()} onCheckedChange={(v) => row.toggleSelected(v === true)} onClick={(e) => e.stopPropagation()} />,
            },
            ...columns,
          ]
        : columns,
    [columns, selectable]
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rowsIn,
    columns: allColumns,
    state: { globalFilter, columnFilters, sorting, rowSelection, columnVisibility: visibility },
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: (u) => setVisibility(typeof u === "function" ? u(visibility) : u),
    getRowId: rowId ? (r) => rowId(r) : undefined,
    enableRowSelection: !!selectable,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: { pagination: { pageSize } },
    globalFilterFn: "includesString",
    autoResetPageIndex: true,
  });

  const rows = table.getRowModel().rows;
  const matching = table.getFilteredRowModel().rows;
  const filtered = matching.length;
  const selected = table.getSelectedRowModel().rows.map((r) => r.original);
  const hasData = (data?.length ?? 0) > 0;
  const filtering = globalFilter !== "" || columnFilters.length > 0 || range !== "all";
  const stats = useMemo(() => (summary && data ? summary(matching.map((r) => r.original)) : []), [summary, data, matching]);
  const hideable = table.getAllLeafColumns().filter((c) => c.getCanHide() && c.id !== "_select" && c.id !== "actions" && (typeof c.columnDef.header === "string" || (c.columnDef.meta as ColumnMeta)?.label));
  const { pageIndex, pageSize: size } = table.getState().pagination;
  const clear = () => setRowSelection({});

  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (!loading && !hasData && empty) return <>{empty}</>;

  return (
    <div className="flex flex-col gap-3">
      {!!stats.length && (
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-card border bg-border sm:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]" aria-label={`${label} summary`}>
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col gap-1 bg-surface px-4 py-3">
              <dt className="eyebrow">{s.label}</dt>
              <dd className="font-display text-xl font-extrabold tabular-nums">{loading && !data ? <Skeleton className="h-6 w-16" /> : s.value}</dd>
              {s.hint && <dd className="text-xs text-muted-foreground">{s.hint}</dd>}
            </div>
          ))}
        </dl>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input type="search" aria-label={searchPlaceholder} placeholder={searchPlaceholder} value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} className="pl-10" />
        </div>
        {dateFilter && (
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-full sm:w-40" aria-label={dateFilter.label ?? "Period"}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {filters.map((f) => {
          const v = (table.getColumn(f.columnId)?.getFilterValue() as string) ?? "all";
          return (
            <Select key={f.columnId} value={v} onValueChange={(val) => table.getColumn(f.columnId)?.setFilterValue(val === "all" ? undefined : val)}>
              <SelectTrigger className="w-full sm:w-44" aria-label={f.label}>
                <SelectValue placeholder={f.label} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All {f.label.toLowerCase()}</SelectItem>
                {f.options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          );
        })}
        {filtering && (
          <Button variant="ghost" size="sm" onClick={() => { setGlobalFilter(""); setColumnFilters([]); setRange("all"); }}>
            <X aria-hidden /> Clear
          </Button>
        )}
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          {toolbar}
          {csv && (
            <Button variant="secondary" disabled={!filtered} onClick={() => downloadCsv(selected.length ? selected : matching.map((r) => r.original), csv.columns, csv.filename)}>
              <Download aria-hidden /> {selected.length ? `Export ${selected.length}` : "Export"}
            </Button>
          )}
          {hideable.length > 2 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" className="max-md:hidden" aria-label="Choose columns"><Columns3 aria-hidden /> Columns</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Show columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {hideable.map((c) => (
                  <DropdownMenuCheckboxItem key={c.id} checked={c.getIsVisible()} onCheckedChange={(v) => c.toggleVisibility(v === true)} onSelect={(e) => e.preventDefault()}>
                    {(c.columnDef.meta as ColumnMeta)?.label ?? String(c.columnDef.header)}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {selectable && selected.length > 0 && (
        <div role="region" aria-label="Selected rows" className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-card border border-primary/40 bg-primary-soft px-4 py-2 shadow-sm">
          <span className="text-sm font-semibold">{selected.length} selected</span>
          {selected.length < filtered && (
            <Button variant="link" size="sm" className="px-1" onClick={() => table.toggleAllRowsSelected(true)}>Select all {filtered}</Button>
          )}
          <Button variant="ghost" size="sm" onClick={clear}>Clear</Button>
          <div className="flex flex-wrap gap-2 sm:ml-auto">{bulkActions?.(selected, clear)}</div>
        </div>
      )}

      {/* Mobile cards */}
      {mobileCard && (
        <ul className="flex flex-col gap-2 md:hidden" aria-label={label}>
          {loading && !data ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-card" />) : rows.map((r) => <li key={r.id}>{mobileCard(r.original)}</li>)}
        </ul>
      )}

      <div className={cn("overflow-hidden rounded-card border bg-surface", mobileCard && "max-md:hidden")}>
        <Table aria-label={label} aria-busy={loading || undefined}>
          <TableHeader className="bg-surface-sunken/60">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((h) => {
                  const sorted = h.column.getIsSorted();
                  const canSort = h.column.getCanSort() && (h.column.columnDef.enableSorting ?? false);
                  const right = (h.column.columnDef.meta as ColumnMeta)?.align === "right";
                  return (
                    <TableHead key={h.id} aria-sort={sorted ? (sorted === "asc" ? "ascending" : "descending") : undefined} className={cn(right && "text-right", h.column.id === "_select" && "w-10")}>
                      {canSort ? (
                        <button className={cn("group inline-flex items-center gap-1 uppercase hover:text-foreground pointer-coarse:min-h-11 pointer-coarse:min-w-11", right && "flex-row-reverse")} onClick={h.column.getToggleSortingHandler()}>
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {sorted === "asc" ? <ArrowUp className="size-3" /> : sorted === "desc" ? <ArrowDown className="size-3" /> : <ArrowUpDown className="size-3 opacity-0 transition-opacity group-hover:opacity-60" />}
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading && !data
              ? Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {table.getVisibleLeafColumns().map((c) => (
                      <TableCell key={c.id}>
                        <Skeleton className="h-4 w-full max-w-32" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : rows.map((row) => {
                  const href = rowHref?.(row.original);
                  return (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() ? "selected" : undefined}
                      className={cn(href && "cursor-pointer", row.getIsSelected() && "bg-primary-soft/40")}
                      onClick={href ? (e) => { if (!(e.target as HTMLElement).closest("a,button,[role=menuitem],[role=checkbox],label")) router.push(href); } : undefined}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className={cn((cell.column.columnDef.meta as ColumnMeta)?.align === "right" && "text-right")}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
          </TableBody>
        </Table>
        {!(loading && !data) && filtered === 0 && <p className="border-t px-4 py-10 text-center text-sm text-muted-foreground">{noResults}</p>}
      </div>

      {!(loading && !data) && mobileCard && filtered === 0 && <p className="rounded-card border bg-surface px-4 py-8 text-center text-sm text-muted-foreground md:hidden">{noResults}</p>}

      {!(loading && !data) && filtered > PAGE_SIZES[0] && (
        <nav className="flex flex-wrap items-center justify-between gap-3" aria-label="Pagination">
          <div className="flex items-center gap-2">
            <p className="font-mono text-xs text-muted-foreground">
              {pageIndex * size + 1}–{Math.min(filtered, (pageIndex + 1) * size)} of {filtered}
            </p>
            <Select value={String(size)} onValueChange={(v) => table.setPageSize(Number(v))}>
              <SelectTrigger size="sm" className="w-28" aria-label="Rows per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((n) => <SelectItem key={n} value={String(n)}>{n} a page</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {table.getPageCount() > 1 && (
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">Page {pageIndex + 1} of {table.getPageCount()}</span>
              <Button variant="secondary" size="icon-sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Previous page">
                <ChevronLeft />
              </Button>
              <Button variant="secondary" size="icon-sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Next page">
                <ChevronRight />
              </Button>
            </div>
          )}
        </nav>
      )}
    </div>
  );
}
