"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useWatch, type FieldValues, type UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import { useUnsavedGuard } from "@/components/save/unsaved-guard";

/** "Nothing here": a form field left empty can be undefined, null or "" and still mean the same. */
const empty = (v: unknown) => v === undefined || v === null || v === "";

/**
 * Deep equality for plain form data (objects, arrays, primitives). Empty values (undefined, null,
 * "") are equal to each other and to a missing key, and a number equals its text ("7" and 7), so a
 * form never looks edited just because a field was normalised.
 */
export function sameValues(a: unknown, b: unknown): boolean {
  if (Object.is(a, b) || (empty(a) && empty(b))) return true;
  if (empty(a) || empty(b)) return false;
  if ((typeof a === "number" && typeof b === "string") || (typeof a === "string" && typeof b === "number")) return String(a) === String(b);
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const bb = b as unknown[];
    return a.length === bb.length && a.every((x, i) => sameValues(x, bb[i]));
  }
  const ka = Object.keys(a as object).filter((k) => !empty((a as Record<string, unknown>)[k]));
  const kb = Object.keys(b as object).filter((k) => !empty((b as Record<string, unknown>)[k]));
  if (ka.length !== kb.length) return false;
  return ka.every((k) => sameValues((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

export interface DirtyForm {
  dirty: boolean;
  saving: boolean;
  error?: string;
  /** Changes are saved on their own a moment after the last edit; there is no Save or Discard to press */
  autosave: boolean;
  /** An autosave just finished */
  justSaved: boolean;
  /** Autosave is waiting on a field that needs fixing */
  blocked: boolean;
  save: () => Promise<void>;
  discard: () => void;
}

/** How long after the last edit an autosave waits */
export const AUTOSAVE_DELAY = 1200;

/**
 * Saving for edit screens. By default changes save themselves a moment after the last edit: no
 * Save button, no Discard, no "leave without saving?" (a pending save is sent when you leave). It
 * compares what's on screen with the last saved values, so changing something and changing it
 * back is no change. `onSave` should throw on failure; the error stays visible with a retry.
 * Pass `autosave: false` where the person is creating something and presses a button to finish.
 */
export function useDirtyForm<T>({
  value,
  saved,
  onSave,
  onDiscard,
  savedMessage = "Saved",
  validate,
  autosave = true,
}: {
  value: T;
  saved: T;
  onSave: (v: T) => Promise<unknown>;
  onDiscard: () => void;
  savedMessage?: string;
  /** Return false to stop the save (for example, a form with errors) */
  validate?: () => boolean | Promise<boolean>;
  autosave?: boolean;
}): DirtyForm {
  const id = useId();
  const guard = useUnsavedGuard();
  const dirty = !sameValues(value, saved);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [justSaved, setJustSaved] = useState(false);
  const [blocked, setBlocked] = useState(false);
  // The values a save was last refused or failed for: autosave waits for a different edit before trying again
  const failedFor = useRef<{ v: T } | null>(null);

  // With autosave only a save that failed counts as unsaved (and is worth a warning)
  useEffect(() => {
    guard.set(id, autosave ? !!error : dirty);
    return () => guard.set(id, false);
  }, [guard, id, dirty, autosave, error]);

  const save = useCallback(async () => {
    if (validate && !(await validate())) {
      failedFor.current = { v: value };
      setBlocked(true);
      return;
    }
    setBlocked(false);
    setSaving(true);
    setError(undefined);
    try {
      await onSave(value);
      failedFor.current = null;
      if (autosave) setJustSaved(true);
      else toast.success(savedMessage, { duration: 2000 });
    } catch (e) {
      failedFor.current = { v: value };
      setError(e instanceof Error ? e.message : "That didn't save. Try again.");
    } finally {
      setSaving(false);
    }
  }, [onSave, value, savedMessage, validate, autosave]);

  const latest = useRef({ save, dirty, saving });
  useEffect(() => {
    latest.current = { save, dirty, saving };
  });

  // Save a moment after the last edit
  useEffect(() => {
    if (!autosave || !dirty || saving) return;
    if (failedFor.current && sameValues(value, failedFor.current.v)) return;
    const t = setTimeout(() => void latest.current.save(), AUTOSAVE_DELAY);
    return () => clearTimeout(t);
  }, [autosave, dirty, saving, value]);

  // Leaving the screen sends whatever is waiting
  useEffect(
    () => () => {
      const l = latest.current;
      if (autosave && l.dirty && !l.saving && !failedFor.current) void l.save();
    },
    [autosave]
  );

  useEffect(() => {
    if (!justSaved) return;
    const t = setTimeout(() => setJustSaved(false), 2500);
    return () => clearTimeout(t);
  }, [justSaved]);

  const discard = useCallback(() => {
    setError(undefined);
    setBlocked(false);
    failedFor.current = null;
    onDiscard();
  }, [onDiscard]);

  return { dirty: dirty || saving, saving, error, autosave, justSaved, blocked: blocked && dirty, save, discard };
}

/**
 * useDirtyForm for react-hook-form screens: watches the form, validates before saving, and resets
 * the form to what was saved so the bar disappears.
 */
export function useFormSaveBar<T extends FieldValues>(form: UseFormReturn<T>, onSave: (v: T) => Promise<unknown>, savedMessage = "Saved", opts: { autosave?: boolean } = {}): DirtyForm {
  const value = useWatch({ control: form.control }) as T;
  const [saved, setSaved] = useState<T>(() => form.getValues());
  return useDirtyForm({
    value,
    saved,
    validate: () => form.trigger(),
    onSave: async () => {
      const v = form.getValues();
      await onSave(v);
      setSaved(v);
      form.reset(v);
    },
    onDiscard: () => form.reset(saved),
    savedMessage,
    autosave: opts.autosave,
  });
}
