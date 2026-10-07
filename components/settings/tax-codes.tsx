"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { TaxCode } from "@/lib/types";

/**
 * The GST reference list. Each product picks one of these codes in its own settings and the
 * code and rate are saved on the product, so there is nothing to add or remove here.
 */
export function TaxCodes({ codes }: { codes: TaxCode[] }) {
  return (
    <div className="overflow-hidden rounded-card border">
      <Table aria-label="HSN and SAC codes">
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Covers</TableHead>
            <TableHead className="text-right">GST</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {codes.map((c) => (
            <TableRow key={c.code}>
              <TableCell><span className="font-mono text-[0.8125rem]">{c.kind} {c.code}</span></TableCell>
              <TableCell className="max-w-[320px] truncate whitespace-normal">{c.description}</TableCell>
              <TableCell className="text-right font-mono text-[0.8125rem]">{c.rate}%</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
