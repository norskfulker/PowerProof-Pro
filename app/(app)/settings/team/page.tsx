"use client";

import { SettingsTabs } from "@/components/settings/settings-tabs";
import { useState } from "react";
import { Loader2, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/pp/confirm-dialog";
import { StatusPill } from "@/components/pp/status-pill";
import { SettingsLoading, SettingsSection } from "@/components/settings/settings-section";
import { useApi } from "@/hooks/use-api";
import { getTeam, inviteMember, removeMember } from "@/lib/api";
import { initials } from "@/lib/format";
import type { TeamMember } from "@/lib/types";

const ROLES: Record<TeamMember["role"], string> = {
  owner: "Owner",
  admin: "Admin · everything except payouts and billing",
  support: "Support · orders, refunds and customers",
};

export default function TeamPage() {
  const { data, error, reload, setData } = useApi(getTeam, []);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamMember["role"]>("support");
  const [formError, setFormError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [toRemove, setToRemove] = useState<TeamMember | null>(null);

  if (!data) return <SettingsLoading error={error} onRetry={reload} />;

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setFormError("That email looks off. Check for typos.");
    setPending(true);
    setFormError(undefined);
    try {
      setData(await inviteMember(email, role));
      toast.success("Invite sent", { description: email });
      setEmail("");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Couldn't invite.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
    <SettingsTabs
      label="Team"
      tabs={[
        { id: "members", label: "Members", content: (
      <SettingsSection title="Team" description={`${data.length} ${data.length === 1 ? "person" : "people"}`}>
        <ul className="divide-y">
          {data.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 py-3">
              <Avatar className="size-10"><AvatarFallback className="bg-primary-soft text-sm font-semibold text-primary">{initials(m.name)}</AvatarFallback></Avatar>
              <span className="min-w-0 flex-1 basis-40">
                <span className="block font-medium">{m.name}</span>
                <span className="block truncate text-sm text-muted-foreground">{m.email} · {ROLES[m.role]}</span>
              </span>
              {m.status === "invited" && <StatusPill status="invited" />}
              {m.role !== "owner" ? (
                <Button variant="ghost" size="sm" onClick={() => setToRemove(m)}><UserMinus aria-hidden /> Remove</Button>
              ) : (
                <StatusPill status="owner" label="Owner" tone="brass" />
              )}
            </li>
          ))}
        </ul>
      </SettingsSection>
        ) },
        { id: "invite", label: "Invite", content: (
      <SettingsSection title="Invite someone" description="An assistant, a designer, your CA. They get their own login; you keep control.">
        <form onSubmit={invite} noValidate className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_220px_auto] sm:items-end">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="inv-email">Email</Label>
            <Input id="inv-email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setFormError(undefined); }} aria-invalid={!!formError || undefined} aria-describedby="inv-err" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="inv-role">Role</Label>
            <Select value={role} onValueChange={(r) => setRole(r as TeamMember["role"])}>
              <SelectTrigger id="inv-role" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="support">Support</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" aria-hidden />} Send invite</Button>
          {formError && <p id="inv-err" role="alert" className="text-sm font-medium text-danger sm:col-span-3">{formError}</p>}
        </form>
      </SettingsSection>
        ) },
      ]}
    />

      <ConfirmDialog
        open={!!toRemove}
        onOpenChange={(o) => !o && setToRemove(null)}
        title={`Remove ${toRemove?.name}?`}
        description="They lose access straight away. Anything they did stays in the history."
        confirmLabel="Remove"
        onConfirm={async () => {
          if (!toRemove) return;
          setData(await removeMember(toRemove.id));
          toast.success("Removed from the team");
        }}
      />
    </>
  );
}
