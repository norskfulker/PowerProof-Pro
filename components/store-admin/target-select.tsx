"use client";

import { createContext, useContext } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SECTION_META, kindOf } from "@/lib/store-themes";
import type { Collection, Product, SectionSetting } from "@/lib/types";

/** What a button or link can point at: filled in once by the layout editor, read by every picker below it. */
interface Options {
  products: Product[];
  collections: Collection[];
  sections: SectionSetting[];
}

const TargetOptions = createContext<Options>({ products: [], collections: [], sections: [] });
export const TargetOptionsProvider = TargetOptions.Provider;

const NONE = "__none";
const URL_CHOICE = "__url";

/**
 * "Button goes to": all products, a store page, a collection, a product, another section on the
 * home page, or any https address. The value is a short string (see LinkTarget in the types).
 */
export function TargetSelect({ id, label, value, onChange, allowNone, hideLabel }: { id: string; label: string; value: string; onChange: (v: string) => void; allowNone?: boolean; hideLabel?: boolean }) {
  const { products, collections, sections } = useContext(TargetOptions);
  const isUrl = value.startsWith("url:");
  const known = value === "" ? NONE : isUrl ? URL_CHOICE : value;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className={hideLabel ? "sr-only" : undefined}>{label}</Label>
      <Select value={known} onValueChange={(v) => onChange(v === NONE ? "" : v === URL_CHOICE ? "url:https://" : v)}>
        <SelectTrigger id={id} className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent>
          {allowNone && <SelectItem value={NONE}>Nowhere</SelectItem>}
          <SelectItem value="products">All products</SelectItem>
          <SelectGroup>
            <SelectLabel>Store pages</SelectLabel>
            <SelectItem value="page:about">About</SelectItem>
            <SelectItem value="page:faq">FAQ</SelectItem>
            <SelectItem value="page:contact">Contact</SelectItem>
          </SelectGroup>
          {sections.filter((s) => s.enabled).length > 0 && (
            <SelectGroup>
              <SelectLabel>Jump to a section on this page</SelectLabel>
              {sections.filter((s) => s.enabled && kindOf(s) !== "announcement").map((s) => <SelectItem key={s.id} value={`section:${s.id}`}>{s.title || SECTION_META[kindOf(s)].name}</SelectItem>)}
            </SelectGroup>
          )}
          {collections.length > 0 && (
            <SelectGroup>
              <SelectLabel>Collections</SelectLabel>
              {collections.map((c) => <SelectItem key={c.id} value={`collection:${c.slug}`}>{c.name}</SelectItem>)}
            </SelectGroup>
          )}
          {products.some((p) => p.status === "published") && (
            <SelectGroup>
              <SelectLabel>Products</SelectLabel>
              {products.filter((p) => p.status === "published").map((p) => <SelectItem key={p.id} value={`product:${p.slug}`}>{p.title}</SelectItem>)}
            </SelectGroup>
          )}
          <SelectItem value={URL_CHOICE}>A website address…</SelectItem>
        </SelectContent>
      </Select>
      {isUrl && (
        <Input
          type="url"
          inputMode="url"
          aria-label={`${label}: website address`}
          placeholder="https://"
          value={value.slice(4)}
          onChange={(e) => onChange(`url:${e.target.value.trim()}`)}
          aria-invalid={!/^(https:\/\/|mailto:)/i.test(value.slice(4)) || undefined}
        />
      )}
      {isUrl && !/^(https:\/\/|mailto:)/i.test(value.slice(4)) && <p className="text-xs text-danger">Start with https:// (or mailto:). Until then this goes to All products.</p>}
    </div>
  );
}
