/** Reading and writing CSV (RFC 4180): quoted fields, doubled quotes, commas and line breaks inside quotes. */

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  // Blank lines aren't rows
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

/** What a CSV cell can hold: text, a number, yes/no, or nothing */
export type CsvValue = string | number | boolean | null | undefined;

const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;
const pad = (n: number) => String(n).padStart(2, "0");
const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;

/**
 * One value as spreadsheets should read it. Timestamps become local "YYYY-MM-DD HH:MM:SS" (Excel
 * and Sheets don't read ISO with T/Z as dates). Phone numbers, long ids and codes with a leading
 * zero or plus stay text (otherwise they turn into 9.19877E+11 or lose the zero), and anything that
 * starts like a formula (= + - @) is kept as text so a spreadsheet never runs it.
 */
export function csvText(v: CsvValue): string {
  if (v == null) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  if (typeof v === "boolean") return v ? "yes" : "no";
  const s = String(v);
  if (ISO_TIME.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
  if (PLAIN_NUMBER.test(s)) {
    const digits = s.replace(/\D/g, "");
    // A real amount or count stays a number; ids, phone numbers and zero-led codes stay text
    if (digits.length < 12 && !/^-?0\d/.test(s)) return s;
    return `\t${s}`;
  }
  if (/^[=+\-@\t\r]/.test(s)) return `\t${s}`;
  return s;
}

const cell = (v: CsvValue) => {
  const s = csvText(v);
  return /[",\n\r\t]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};
export const toCsv = (rows: CsvValue[][]): string => rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";

/**
 * Saves rows as a spreadsheet file from the browser, named `name-YYYY-MM-DD.csv`. Written as UTF-8
 * with a byte-order mark so Excel shows ₹, accents and non-Latin names correctly.
 */
export function downloadCsv(name: string, rows: CsvValue[][]) {
  const blob = new Blob(["\ufeff", toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Some browsers start the download after click returns
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
