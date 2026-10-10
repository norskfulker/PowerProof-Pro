"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, MoreHorizontal, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/pp/confirm-dialog";
import { EmptyState } from "@/components/pp/empty-state";
import { StatusPill } from "@/components/pp/status-pill";
import { usePlan } from "@/components/plan/plan-context";
import { SettingsLoading, SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useApi } from "@/hooks/use-api";
import { useCurrentStore } from "@/hooks/use-current-store";
import { ApiError, getTeam, inviteTeamMember, myMembership, removeTeamMember, updateTeamMember, type TeamPerson } from "@/lib/api";
import { formatDate, initials, timeAgo } from "@/lib/format";
import { areaLabels, can, roleLabel, TEAM_AREAS, type TeamArea } from "@/lib/team";

type Editing = { mode: "invite" } | { mode: "edit"; person: TeamPerson };

function CopyLink({ link }: { link: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="invite-link">Invite link</Label>
      <div className="flex gap-2">
        <Input id="invite-link" readOnly value={link} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
        <Button
          type="button"
          variant="secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              setDone(true);
              setTimeout(() => setDone(false), 1500);
            } catch {
              toast.error("Couldn't copy. Select the link instead.");
            }
          }}
        >
          {done ? <Check aria-hidden /> : <Copy aria-hidden />} Copy
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Only someone signed in with the invited email can use it. It works for 7 days.</p>
    </div>
  );
}

/** Invite someone, or change what they can do */
function PersonSheet({ editing, isOwner, onClose, onDone }: { editing: Editing | null; isOwner: boolean; onClose: () => void; onDone: () => void }) {
  const person = editing?.mode === "edit" ? editing.person : undefined;
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [areas, setAreas] = useState<TeamArea[]>(["orders"]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [link, setLink] = useState<string>();
  const [opened, setOpened] = useState<Editing | null>(null);
  const plan = usePlan();

  // Reset the form each time the sheet opens for someone
  if (editing !== opened) {
    setOpened(editing);
    setEmail("");
    setRole(person?.role === "admin" ? "admin" : "member");
    setAreas(person ? person.areas : ["orders"]);
    setError(undefined);
    setLink(undefined);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    if (!person && !/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Type the email address to invite.");
    if (role === "member" && !areas.length) return setError("Pick at least one part of the store they can work on.");
    setBusy(true);
    try {
      if (person?.id) {
        await updateTeamMember(person.id, role, areas);
        toast.success("Access updated", { description: `${person.name || person.email} sees the change next time a page loads.` });
        onDone();
        onClose();
      } else {
        const r = await inviteTeamMember({ email: email.trim(), role, areas });
        onDone();
        if (r.emailed) {
          toast.success("Invite sent", { description: `We emailed ${email.trim()} a link to join.` });
          onClose();
        } else {
          setLink(r.link);
        }
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === "limit") plan.upgrade();
      setError(err instanceof Error ? err.message : "That didn't save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={!!editing} onOpenChange={(o) => !o && !busy && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl">{person ? `Access for ${person.name || person.email}` : "Invite someone"}</SheetTitle>
          <SheetDescription>{person ? "Choose what they can work on in this store." : "They get an email with a link to join. They'll need a PowerProof login with that email (it's free)."}</SheetDescription>
        </SheetHeader>
        {link ? (
          <div className="flex flex-col gap-4 px-4 pb-6">
            <p role="status" className="rounded-control border border-warning/40 bg-warning-soft px-3 py-2 text-sm">
              Invite saved. Email isn&apos;t connected on this site, so send them this link yourself (WhatsApp, email, anything).
            </p>
            <CopyLink link={link} />
            <Button onClick={onClose} className="self-start">Done</Button>
          </div>
        ) : (
          <form noValidate onSubmit={submit} className="flex flex-col gap-5 px-4 pb-6">
            {!person && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="team-email">Email</Label>
                <Input id="team-email" type="email" autoComplete="off" value={email} onChange={(e) => { setEmail(e.target.value); setError(undefined); }} placeholder="name@example.com" />
              </div>
            )}
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-semibold">Role</legend>
              {(
                [
                  ["member", "Limited", "Only the parts of the store you pick below."],
                  ["admin", "Admin", isOwner ? "Everything except payouts and billing. Can invite people too." : "Only the store's owner can make admins."],
                ] as const
              ).map(([v, label, hint]) => (
                <label key={v} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-control border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
                  <input type="radio" name="team-role" value={v} checked={role === v} disabled={v === "admin" && !isOwner} onChange={() => setRole(v)} className="mt-1 accent-[var(--primary)]" />
                  <span className="flex flex-col"><span className="font-medium">{label}</span><span className="text-xs text-muted-foreground">{hint}</span></span>
                </label>
              ))}
            </fieldset>
            {role === "member" && (
              <fieldset className="flex flex-col gap-1">
                <legend className="mb-1 text-sm font-semibold">What they can work on</legend>
                {TEAM_AREAS.map((a) => (
                  <label key={a.id} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-control px-1 py-2 text-sm hover:bg-muted">
                    <Checkbox className="mt-0.5" checked={areas.includes(a.id)} onCheckedChange={(v) => setAreas((cur) => (v === true ? [...new Set([...cur, a.id])] : cur.filter((x) => x !== a.id)))} />
                    <span className="flex flex-col"><span className="font-medium">{a.label}</span><span className="text-xs text-muted-foreground">{a.body}</span></span>
                  </label>
                ))}
                <p className="mt-1 text-xs text-muted-foreground">Payouts, payout accounts, billing and deleting the store always stay with the owner.</p>
              </fieldset>
            )}
            {error && <p role="alert" className="rounded-control border border-danger/40 bg-danger-soft px-3 py-2 text-sm font-medium text-danger">{error}</p>}
            <SheetFooter className="p-0">
              <Button type="submit" disabled={busy}>{busy ? <Loader2 className="animate-spin" aria-hidden /> : person ? <Check aria-hidden /> : <UserPlus aria-hidden />} {person ? "Save access" : "Send invite"}</Button>
            </SheetFooter>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}

function PersonRow({ p, manage, isOwner, onEdit, onResend, onRemove }: { p: TeamPerson; manage: boolean; isOwner: boolean; onEdit: () => void; onResend: () => void; onRemove: () => void }) {
  const canTouch = manage && p.role !== "owner" && (isOwner || (p.role !== "admin" && !p.isYou));
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft font-mono text-xs font-semibold text-primary" aria-hidden>{initials(p.name || p.email)}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{p.name || p.email}{p.isYou && <span className="font-normal text-muted-foreground"> (you)</span>}</span>
        {p.name && <span className="truncate text-xs text-muted-foreground">{p.email}</span>}
        <span className="text-xs text-muted-foreground">
          {p.role === "owner" ? "Owns this store" : p.role === "admin" ? "Everything except payouts and billing" : areaLabels(p.areas).join(", ")}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <StatusPill status={p.status === "invited" ? "invited" : p.role} label={p.status === "invited" ? "Invited" : roleLabel(p.role)} tone={p.status === "invited" ? "warning" : p.role === "owner" ? "primary" : p.role === "admin" ? "info" : "neutral"} />
        <span className="text-[0.6875rem] text-muted-foreground">
          {p.status === "invited"
            ? p.expired
              ? "Link expired"
              : `Sent ${timeAgo(p.invitedAt)}`
            : p.lastSeenAt
              ? `Active ${timeAgo(p.lastSeenAt)}`
              : p.joinedAt
                ? `Joined ${formatDate(p.joinedAt)}`
                : ""}
        </span>
      </span>
      {canTouch && p.id && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Options for ${p.name || p.email}`}><MoreHorizontal aria-hidden /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEdit}>Change access</DropdownMenuItem>
            {p.status === "invited" && <DropdownMenuItem onSelect={onResend}>Send a new invite link</DropdownMenuItem>}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-danger" onSelect={onRemove}>{p.status === "invited" ? "Cancel invite" : "Remove from team"}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  );
}

/** For someone who joined: what they can do here, and a way to leave */
function MyAccess({ storeName }: { storeName: string }) {
  const router = useRouter();
  const me = useApi(myMembership, []);
  const [confirm, setConfirm] = useState(false);
  if (!me.data) return <SettingsLoading error={me.error} onRetry={me.reload} />;
  const m = me.data;
  return (
    <SettingsSection title="Your access" description={`You're on the ${storeName} team. The owner decides what you can work on.`}>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="text-muted-foreground">Role</dt><dd className="font-medium">{roleLabel(m.role)}</dd>
        <dt className="text-muted-foreground">You can work on</dt><dd>{m.role === "admin" ? "Everything except payouts and billing" : areaLabels(m.areas).join(", ")}</dd>
      </dl>
      <Button variant="ghost" className="mt-4 text-danger" onClick={() => setConfirm(true)}>Leave this store</Button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Leave ${storeName}?`}
        description="You'll lose access straight away. The owner can invite you again."
        confirmLabel="Leave store"
        onConfirm={async () => {
          try {
            await removeTeamMember(m.id);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "That didn't work. Try again.");
            throw e;
          }
          toast.success(`You left ${storeName}`);
          router.push("/dashboard");
          router.refresh();
        }}
      />
    </SettingsSection>
  );
}

export default function TeamPage() {
  const store = useCurrentStore();
  const access = store.data?.access;
  const manage = can(access, "team");
  const isOwner = access?.role === "owner";
  const plan = usePlan();
  const team = useApi(() => (manage ? getTeam() : Promise.resolve([] as TeamPerson[])), [manage]);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [removing, setRemoving] = useState<TeamPerson | null>(null);
  const router = useRouter();

  if (!store.data) return <SettingsLoading error={store.error} onRetry={store.reload} />;
  if (!manage) return <MyAccess storeName={store.data.name} />;
  if (!team.data) return <SettingsLoading error={team.error} onRetry={team.reload} />;

  const people = team.data;
  const used = people.filter((p) => p.role !== "owner").length;
  const seats = plan.state ? plan.limits?.[plan.state.tier]?.teamSeats : undefined;
  const full = seats !== undefined && seats !== null && used >= seats;
  const me = people.find((p) => p.isYou && p.id);

  return (
    <div className="flex flex-col gap-6">
      <SettingsSection
        title="Team"
        description={
          <>
            People who help run {store.data.name}. Each sees only the parts you give them; payouts, payout accounts and billing stay with the owner.
            {seats !== undefined && <> {seats === null ? `${used} invited or joined.` : `${used} of ${seats} seats used.`}</>}
          </>
        }
        saveBar={
          <Button onClick={() => (full ? plan.upgrade() : setEditing({ mode: "invite" }))}>
            <UserPlus aria-hidden /> Invite someone
          </Button>
        }
      >
        {people.length <= 1 ? (
          <EmptyState compact icon={Users} title="It's just you for now." body="Invite someone to help with orders, products or the store's design. You choose what each person can see and change." />
        ) : null}
        <ul className="divide-y">
          {people.map((p) => (
            <PersonRow
              key={p.id ?? "owner"}
              p={p}
              manage={manage}
              isOwner={isOwner}
              onEdit={() => setEditing({ mode: "edit", person: p })}
              onResend={async () => {
                try {
                  const r = await inviteTeamMember({ email: p.email, role: p.role === "admin" ? "admin" : "member", areas: p.areas });
                  team.reload();
                  if (r.emailed) toast.success("New invite sent", { description: `The old link no longer works.` });
                  else {
                    await navigator.clipboard.writeText(r.link).catch(() => undefined);
                    toast.success("New invite link copied", { description: "Email isn't connected here, so paste it to them yourself." });
                  }
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "That didn't work. Try again.");
                }
              }}
              onRemove={() => setRemoving(p)}
            />
          ))}
        </ul>
        {full && <p className="mt-3 text-sm text-muted-foreground">Every seat on your plan is used. Remove someone or cancel an invite to add another{plan.state?.tier === "free" ? ", or upgrade to Pro for more seats" : ""}.</p>}
        {me && !isOwner && (
          <Button variant="ghost" className="mt-3 text-danger" onClick={() => setRemoving(me)}>Leave this store</Button>
        )}
      </SettingsSection>

      <PersonSheet editing={editing} isOwner={isOwner} onClose={() => setEditing(null)} onDone={team.reload} />
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={removing?.isYou ? `Leave ${store.data.name}?` : removing?.status === "invited" ? `Cancel the invite to ${removing.email}?` : `Remove ${removing?.name || removing?.email}?`}
        description={removing?.isYou ? "You'll lose access straight away." : removing?.status === "invited" ? "The link they were sent stops working." : "They lose access to this store straight away. Their own stores aren't affected."}
        confirmLabel={removing?.isYou ? "Leave store" : removing?.status === "invited" ? "Cancel invite" : "Remove"}
        onConfirm={async () => {
          if (!removing?.id) return;
          try {
            await removeTeamMember(removing.id);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "That didn't work. Try again.");
            throw e;
          }
          toast.success(removing.isYou ? "You left the store" : removing.status === "invited" ? "Invite cancelled" : "Removed from the team");
          if (removing.isYou) {
            router.push("/dashboard");
            router.refresh();
          } else team.reload();
        }}
      />
    </div>
  );
}
