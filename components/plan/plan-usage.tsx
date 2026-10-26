"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { planComparison, type AllPlanLimits } from "@/lib/plans";
import { usePlan } from "./plan-context";

/** Free vs Pro, for /pricing and /settings/billing. */
export function PlanComparisonTable({ current, limits }: { current?: "free" | "pro"; limits?: AllPlanLimits }) {
  const ctx = usePlan();
  const l = limits ?? ctx.limits;
  return (
    <Table className="min-w-[30rem]">
      <TableHeader>
        <TableRow>
          <TableHead scope="col">What you get</TableHead>
          <TableHead scope="col">Free{current === "free" ? " (yours)" : ""}</TableHead>
          <TableHead scope="col">Pro{current === "pro" ? " (yours)" : ""}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {(l ? planComparison(l) : []).map((r) => (
          <TableRow key={r.feature}>
            <TableHead scope="row" className="font-medium text-foreground">{r.feature}</TableHead>
            <TableCell>{r.free}</TableCell>
            <TableCell className="font-medium">{r.pro}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
