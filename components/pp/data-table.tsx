"use client";

import { useState } from "react";
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
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  pageSize = 10,
  label,
  toolbar,
}: {
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
  /** Accessible table name */
  label: string;
  toolbar?: React.ReactNode;
}) {
  const router = useRouter();
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(initialFilters);
  const [sorting, setSorting] = useState<SortingState>([]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: data ?? [],
    columns,
    state: { globalFilter, columnFilters, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: { pagination: { pageSize } },
    globalFilterFn: "includesString",
  });

  const rows = table.getRowModel().rows;
  const filtered = table.getFilteredRowModel().rows.length;
  const hasData = (data?.length ?? 0) > 0;
  const filtering = globalFilter !== "" || columnFilters.length > 0;

  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (!loading && !hasData && empty) return <>{empty}</>;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            aria-label={searchPlaceholder}
            placeholder={searchPlaceholder}
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-10"
          />
        </div>
        {filters.map((f) => {
          const v = (table.getColumn(f.columnId)?.getFilterValue() as string) ?? "all";
          return (
            <Select key={f.columnId} value={v} onValueChange={(val) => table.getColumn(f.columnId)?.setFilterValue(val === "all" ? undefined : val)}>
              <SelectTrigger className="w-full sm:w-44" aria-label={f.label}>
                <SelectValue placeholder={f.label} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All {f.label.toLowerCase()}</SelectItem>
                {f.options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        })}
        {filtering && (
          <Button variant="ghost" size="sm" onClick={() => { setGlobalFilter(""); setColumnFilters([]); }}>
            <X aria-hidden /> Clear
          </Button>
        )}
        {toolbar && <div className="flex gap-2 sm:ml-auto">{toolbar}</div>}
      </div>

      {/* Mobile cards */}
      {mobileCard && (
        <ul className="flex flex-col gap-2 md:hidden" aria-label={label}>
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-card" />)
            : rows.map((r) => <li key={r.id}>{mobileCard(r.original)}</li>)}
        </ul>
      )}

      <div className={cn("overflow-hidden rounded-card border bg-surface", mobileCard && "max-md:hidden")}>
        <Table aria-label={label} aria-busy={loading || undefined}>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => {
                  const sorted = h.column.getIsSorted();
                  const canSort = h.column.getCanSort() && (h.column.columnDef.enableSorting ?? false);
                  return (
                    <TableHead
                      key={h.id}
                      aria-sort={sorted ? (sorted === "asc" ? "ascending" : "descending") : undefined}
                      className={cn((h.column.columnDef.meta as { align?: string })?.align === "right" && "text-right")}
                    >
                      {canSort ? (
                        <button className="inline-flex items-center gap-1 uppercase hover:text-foreground" onClick={h.column.getToggleSortingHandler()}>
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {sorted === "asc" ? <ArrowUp className="size-3" /> : sorted === "desc" ? <ArrowDown className="size-3" /> : null}
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
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {columns.map((_, j) => (
                      <TableCell key={j}>
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
                      className={cn(href && "cursor-pointer")}
                      onClick={href ? (e) => { if (!(e.target as HTMLElement).closest("a,button,[role=menuitem]")) router.push(href); } : undefined}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className={cn((cell.column.columnDef.meta as { align?: string })?.align === "right" && "text-right")}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
          </TableBody>
        </Table>
        {!loading && filtered === 0 && (
          <p className="border-t px-4 py-10 text-center text-sm text-muted-foreground">{noResults}</p>
        )}
      </div>

      {!loading && mobileCard && filtered === 0 && (
        <p className="rounded-card border bg-surface px-4 py-8 text-center text-sm text-muted-foreground md:hidden">{noResults}</p>
      )}

      {!loading && table.getPageCount() > 1 && (
        <nav className="flex items-center justify-between gap-3" aria-label="Pagination">
          <p className="font-mono text-xs text-muted-foreground">
            {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}–
            {Math.min(filtered, (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize)} of {filtered}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" size="icon-sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Previous page">
              <ChevronLeft />
            </Button>
            <Button variant="secondary" size="icon-sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Next page">
              <ChevronRight />
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}
