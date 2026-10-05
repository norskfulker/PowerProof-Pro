"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { useWatch, type FieldValues, type UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import { useUnsavedGuard } from "@/components/save/unsaved-guard";

/** Deep equality for plain form data (objects, arrays, primitives). */
export function sameValues(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a as object).filter((k) => (a as Record<string, unknown>)[k] !== undefined);
  const kb = Object.keys(b as object).filter((k) => (b as Record<string, unknown>)[k] !== undefined);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => sameValues((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

export interface DirtyForm {
  dirty: boolean;
  saving: boolean;
  error?: string;
  save: () => Promise<void>;
  discard: () => void;
}

/**
 * The save-bar contract (Part 6F). Compares what's on screen with the last saved values, so
 * changing something and changing it back counts as no change. Registers with the unsaved-changes
 * guard while dirty. `onSave` should throw on failure; the error stays visible and the bar stays.
 */
export function useDirtyForm<T>({
  value,
  saved,
  onSave,
  onDiscard,
  savedMessage = "Saved",
  validate,
}: {
  value: T;
  saved: T;
  onSave: (v: T) => Promise<unknown>;
  onDiscard: () => void;
  savedMessage?: string;
  /** Return false to stop the save (for example, a form with errors) */
  validate?: () => boolean | Promise<boolean>;
}): DirtyForm {
  const id = useId();
  const guard = useUnsavedGuard();
  const dirty = !sameValues(value, saved);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    guard.set(id, dirty);
    return () => guard.set(id, false);
  }, [guard, id, dirty]);

  const save = useCallback(async () => {
    if (validate && !(await validate())) return;
    setSaving(true);
    setError(undefined);
    try {
      await onSave(value);
      toast.success(savedMessage, { duration: 2000 });
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't save. Try again.");
    } finally {
      setSaving(false);
    }
  }, [onSave, value, savedMessage, validate]);

  const discard = useCallback(() => {
    setError(undefined);
    onDiscard();
  }, [onDiscard]);

  return { dirty: dirty || saving, saving, error, save, discard };
}

/**
 * useDirtyForm for react-hook-form screens: watches the form, validates before saving, and resets
 * the form to what was saved so the bar disappears.
 */
export function useFormSaveBar<T extends FieldValues>(form: UseFormReturn<T>, onSave: (v: T) => Promise<unknown>, savedMessage = "Saved"): DirtyForm {
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
  });
}
