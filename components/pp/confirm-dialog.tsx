"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** The only dialog pattern in the product: confirm something destructive. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => Promise<void> | void;
  children?: React.ReactNode;
}) {
  const [pending, setPending] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button
            variant="danger"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              try {
                await onConfirm();
                onOpenChange(false);
              } finally {
                setPending(false);
              }
            }}
          >
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReasonBody({
  title,
  description,
  confirmLabel,
  label,
  placeholder,
  minLength,
  multiline,
  tone,
  onConfirm,
  onClose,
}: {
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  label: string;
  placeholder?: string;
  minLength: number;
  multiline: boolean;
  tone: "danger" | "primary";
  onConfirm: (value: string) => Promise<void>;
  onClose: () => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const ok = value.trim().length >= minLength;
  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display text-xl">{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <Label htmlFor="reason-field">{label}</Label>
        {multiline ? (
          <Textarea id="reason-field" rows={3} value={value} maxLength={300} placeholder={placeholder} onChange={(e) => setValue(e.target.value)} />
        ) : (
          <Input id="reason-field" value={value} maxLength={80} placeholder={placeholder} onChange={(e) => setValue(e.target.value)} />
        )}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      </div>
      <DialogFooter>
        <Button variant="secondary" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button
          variant={tone}
          disabled={pending || !ok}
          onClick={async () => {
            setPending(true);
            setError(undefined);
            try {
              await onConfirm(value.trim());
              onClose();
            } catch (e) {
              setError(e instanceof Error ? e.message : "That didn't work. Try again.");
            } finally {
              setPending(false);
            }
          }}
        >
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {confirmLabel}
        </Button>
      </DialogFooter>
    </>
  );
}

/** Asks for a short written reason (or a reference) before doing something that is written to the audit log */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  label = "Reason",
  placeholder,
  minLength = 5,
  multiline = true,
  tone = "danger",
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  label?: string;
  placeholder?: string;
  minLength?: number;
  multiline?: boolean;
  tone?: "danger" | "primary";
  onConfirm: (value: string) => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <ReasonBody title={title} description={description} confirmLabel={confirmLabel} label={label} placeholder={placeholder} minLength={minLength} multiline={multiline} tone={tone} onConfirm={onConfirm} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
