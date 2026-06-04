"use client";

import { useState } from "react";
import {
  User as UserIcon, Lock, Users as UsersIcon, KeyRound, Webhook as WebhookIcon,
  Copy, Check, Trash2, Plus, AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tabs, type TabDef } from "@/components/ui/Tabs";
import { useAuth } from "@/hooks/useAuth";
import { useMyProfile, useUpdateMyProfile, useChangePassword, useUsers, useCreateUser, useToggleUserActive } from "@/hooks/useUsers";
import { useApiKeys, useCreateApiKey, useRevokeApiKey } from "@/hooks/useApiKeys";
import { useWebhooks, useCreateWebhook, useDeleteWebhook, useUpdateWebhook } from "@/hooks/useWebhooks";
import { WEBHOOK_EVENTS } from "@/lib/api-client";
import { formatRelativeTime, cn } from "@/lib/utils";

type Tab = "profile" | "security" | "team" | "api-keys" | "webhooks";

const ALL_TABS: (TabDef & { adminOnly?: boolean })[] = [
  { id: "profile", label: "Profile", icon: <UserIcon className="h-4 w-4" /> },
  { id: "security", label: "Security", icon: <Lock className="h-4 w-4" /> },
  { id: "team", label: "Team", icon: <UsersIcon className="h-4 w-4" />, adminOnly: true },
  { id: "api-keys", label: "API Keys", icon: <KeyRound className="h-4 w-4" /> },
  { id: "webhooks", label: "Webhooks", icon: <WebhookIcon className="h-4 w-4" />, adminOnly: true },
];

function SecretReveal({ label, value, onDone }: { label: string; value: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <Card className="border-[color-mix(in_srgb,var(--warn)_30%,transparent)] bg-warn-subtle">
      <div className="mb-3 flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 text-warn" />
        <p className="text-xs text-warn">{label} — copy it now, it won&apos;t be shown again.</p>
      </div>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded-lg border border-line-strong bg-surface px-3 py-2 font-mono text-xs text-fg">{value}</code>
        <Button variant="secondary" size="sm" onClick={() => { navigator.clipboard?.writeText(value); setCopied(true); }}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="sm" onClick={onDone}>Done</Button>
      </div>
    </Card>
  );
}

function ProfileSection() {
  const { data: profile } = useMyProfile();
  const { mutate: update, isPending, isSuccess } = useUpdateMyProfile();
  const [fullName, setFullName] = useState<string | null>(null);
  const value = fullName ?? profile?.full_name ?? "";
  return (
    <Card className="max-w-xl space-y-5">
      <div>
        <h3 className="text-h3 text-fg">Profile</h3>
        <p className="mt-0.5 text-xs text-subtle">Manage your personal information.</p>
      </div>
      <Input label="Full name" value={value} onChange={(e) => setFullName(e.target.value)} />
      <Input label="Email" value={profile?.email ?? ""} disabled hint="Email cannot be changed." />
      <div className="flex flex-wrap gap-2">{profile?.roles.map((r) => <Badge key={r.id} tone="accent">{r.display_name ?? r.name}</Badge>)}</div>
      <div className="flex items-center gap-3">
        <Button onClick={() => update({ full_name: value })} isLoading={isPending} disabled={!value.trim()}>Save changes</Button>
        {isSuccess && <span className="text-xs text-success">Saved ✓</span>}
      </div>
    </Card>
  );
}

function SecuritySection() {
  const { mutate, isPending, isSuccess, error, reset } = useChangePassword();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const mismatch = confirm.length > 0 && next !== confirm;
  return (
    <Card className="max-w-xl space-y-5">
      <div>
        <h3 className="text-h3 text-fg">Change password</h3>
        <p className="mt-0.5 text-xs text-subtle">At least 8 characters, with an uppercase letter and a digit.</p>
      </div>
      <Input label="Current password" type="password" value={current} onChange={(e) => { setCurrent(e.target.value); reset(); }} />
      <Input label="New password" type="password" value={next} onChange={(e) => setNext(e.target.value)} />
      <Input label="Confirm new password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={mismatch ? "Passwords do not match" : undefined} />
      {error && <p className="text-xs text-danger">Could not change password. Check your current password.</p>}
      <div className="flex items-center gap-3">
        <Button onClick={() => mutate({ current_password: current, new_password: next }, { onSuccess: () => { setCurrent(""); setNext(""); setConfirm(""); } })} isLoading={isPending} disabled={!current || !next || mismatch}>
          Update password
        </Button>
        {isSuccess && <span className="text-xs text-success">Password updated ✓</span>}
      </div>
    </Card>
  );
}

function TeamSection() {
  const { data, isLoading } = useUsers({ page_size: 50 });
  const { mutate: create, isPending: creating } = useCreateUser();
  const { mutate: toggle } = useToggleUserActive();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", full_name: "", password: "" });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-h3 text-fg">Team members</h3>
          <p className="mt-0.5 text-xs text-subtle">{data?.total ?? 0} members in your workspace.</p>
        </div>
        <Button size="sm" onClick={() => setOpen((o) => !o)}><Plus className="h-4 w-4" /> Invite</Button>
      </div>
      {open && (
        <Card className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input label="Full name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input label="Temp password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" isLoading={creating} disabled={!form.email || !form.full_name || !form.password}
              onClick={() => create({ ...form, roles: ["member"] }, { onSuccess: () => { setForm({ email: "", full_name: "", password: "" }); setOpen(false); } })}>
              Create user
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </Card>
      )}
      <Card padded={false} className="overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-line">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 shimmer" />)}</div>
        ) : (
          <div className="divide-y divide-line">
            {data?.items.map((u) => (
              <div key={u.id} className="flex items-center gap-4 p-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-subtle text-xs font-semibold text-accent">{u.full_name?.charAt(0)?.toUpperCase() ?? "?"}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-fg">{u.full_name}</p>
                  <p className="truncate text-xs text-subtle">{u.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  {u.roles.map((r) => <Badge key={r.id} tone="neutral">{r.name}</Badge>)}
                  <Badge tone={u.is_active ? "success" : "danger"} dot>{u.is_active ? "Active" : "Inactive"}</Badge>
                  <Button size="xs" variant="ghost" onClick={() => toggle({ id: u.id, active: !u.is_active })}>{u.is_active ? "Deactivate" : "Activate"}</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function ApiKeysSection() {
  const { data, isLoading } = useApiKeys();
  const { mutate: create, isPending } = useCreateApiKey();
  const { mutate: revoke } = useRevokeApiKey();
  const [name, setName] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-h3 text-fg">API keys</h3>
        <p className="mt-0.5 text-xs text-subtle">Programmatic access to the DocuMind API.</p>
      </div>
      {secret && <SecretReveal label="New API key" value={secret} onDone={() => setSecret(null)} />}
      <Card className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1"><Input label="Key name" placeholder="e.g. Production server" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <Button isLoading={isPending} disabled={!name.trim()} onClick={() => create({ name: name.trim(), scopes: ["read", "write"] }, { onSuccess: (k) => { setSecret(k.api_key); setName(""); } })}>
          <Plus className="h-4 w-4" /> Create key
        </Button>
      </Card>
      <Card padded={false} className="overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-line">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-16 shimmer" />)}</div>
        ) : data?.items.length === 0 ? (
          <EmptyState icon={KeyRound} title="No API keys yet" description="Create a key to access the API programmatically." />
        ) : (
          <div className="divide-y divide-line">
            {data?.items.map((k) => (
              <div key={k.id} className="flex items-center gap-4 p-4">
                <KeyRound className="h-4 w-4 text-subtle" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-fg">{k.name}</p>
                  <p className="font-mono text-xs text-subtle">{k.key_prefix}••••••</p>
                </div>
                <div className="flex items-center gap-2">
                  {k.scopes.map((s) => <Badge key={s} tone="neutral">{s}</Badge>)}
                  <Badge tone={k.is_active ? "success" : "danger"} dot>{k.is_active ? "Active" : "Revoked"}</Badge>
                  <span className="text-[11px] text-subtle">{k.last_used_at ? `used ${formatRelativeTime(k.last_used_at)}` : "never used"}</span>
                  {k.is_active && (
                    <button aria-label="Revoke key" onClick={() => revoke(k.id)} className="text-subtle transition-colors hover:text-danger"><Trash2 className="h-4 w-4" /></button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function WebhooksSection() {
  const { data, isLoading } = useWebhooks();
  const { mutate: create, isPending } = useCreateWebhook();
  const { mutate: del } = useDeleteWebhook();
  const { mutate: update } = useUpdateWebhook();
  const [form, setForm] = useState<{ name: string; url: string; events: string[] }>({ name: "", url: "", events: ["document.ready"] });
  const [secret, setSecret] = useState<string | null>(null);
  const toggleEvent = (e: string) => setForm((f) => ({ ...f, events: f.events.includes(e) ? f.events.filter((x) => x !== e) : [...f.events, e] }));
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-h3 text-fg">Webhooks</h3>
        <p className="mt-0.5 text-xs text-subtle">Receive HMAC-signed event notifications at your endpoint.</p>
      </div>
      {secret && <SecretReveal label="Webhook signing secret" value={secret} onDone={() => setSecret(null)} />}
      <Card className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Endpoint URL" placeholder="https://…" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
        </div>
        <div>
          <p className="mb-2 text-xs text-muted">Events</p>
          <div className="flex flex-wrap gap-2">
            {WEBHOOK_EVENTS.map((e) => (
              <button key={e} onClick={() => toggleEvent(e)}
                className={cn("rounded-lg border px-2.5 py-1 font-mono text-xs transition-all",
                  form.events.includes(e) ? "border-[color-mix(in_srgb,var(--accent)_30%,transparent)] bg-accent-subtle text-accent" : "border-line bg-surface text-subtle")}>
                {e}
              </button>
            ))}
          </div>
        </div>
        <Button isLoading={isPending} disabled={!form.name || !form.url || form.events.length === 0}
          onClick={() => create(form, { onSuccess: (w) => { setSecret(w.secret); setForm({ name: "", url: "", events: ["document.ready"] }); } })}>
          <Plus className="h-4 w-4" /> Add webhook
        </Button>
      </Card>
      <Card padded={false} className="overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-line">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-16 shimmer" />)}</div>
        ) : data?.items.length === 0 ? (
          <EmptyState icon={WebhookIcon} title="No webhooks configured" description="Add an endpoint to receive event notifications." />
        ) : (
          <div className="divide-y divide-line">
            {data?.items.map((w) => (
              <div key={w.id} className="flex items-center gap-4 p-4">
                <WebhookIcon className="h-4 w-4 text-subtle" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-fg">{w.name}</p>
                  <p className="truncate font-mono text-xs text-subtle">{w.url}</p>
                </div>
                <div className="flex items-center gap-2">
                  {w.failure_count > 0 && <Badge tone="warn">{w.failure_count} fails</Badge>}
                  <Badge tone={w.is_active ? "success" : "neutral"} dot>{w.is_active ? "Active" : "Paused"}</Badge>
                  <Button size="xs" variant="ghost" onClick={() => update({ id: w.id, data: { is_active: !w.is_active } })}>{w.is_active ? "Pause" : "Resume"}</Button>
                  <button aria-label="Delete webhook" onClick={() => del(w.id)} className="text-subtle transition-colors hover:text-danger"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.is_superadmin || user?.roles?.includes("org_admin");
  const [tab, setTab] = useState<Tab>("profile");
  const tabs = ALL_TABS.filter((t) => !t.adminOnly || isAdmin);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Workspace" title="Settings" subtitle="Manage your account, team, and integrations." />
      <Tabs tabs={tabs} value={tab} onChange={(id) => setTab(id as Tab)} />
      <div className="pt-2">
        {tab === "profile" && <ProfileSection />}
        {tab === "security" && <SecuritySection />}
        {tab === "team" && isAdmin && <TeamSection />}
        {tab === "api-keys" && <ApiKeysSection />}
        {tab === "webhooks" && isAdmin && <WebhooksSection />}
      </div>
    </div>
  );
}
