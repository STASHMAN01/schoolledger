"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useOrg } from "../../OrgContext";
import { Button, Card, EmptyState, PageHeader, Textarea } from "@/components/ui";
import { formatCents } from "@/lib/formatMoney";
import { useConfirmDialog } from "@/components/useConfirmDialog";
import {
  DEFAULT_REMINDER_TEMPLATE,
  REMINDER_TEMPLATES,
  missingRequiredPlaceholders,
  renderReminderTemplate,
} from "@/lib/billing/reminderTemplates";
import { formatMoneyCents } from "@/lib/money";
import { formatDateZA } from "@/lib/date";

type Reminder = {
  childId: string;
  childName: string;
  categoryName: string;
  parentName: string;
  parentPhone: string | null;
  parentEmail: string | null;
  lastReminderSentAt: string | null;
  outstandingCents: number;
  message: string;
};

function waLink(phone: string, message: string) {
  return `https://wa.me/${phone.replace(/[^\d]/g, "")}?text=${encodeURIComponent(message)}`;
}
function mailLink(email: string, message: string) {
  return `mailto:${email}?subject=${encodeURIComponent("Payment reminder")}&body=${encodeURIComponent(message)}`;
}

export default function RemindersPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading...</p>}>
      <RemindersPageInner />
    </Suspense>
  );
}

type SendPreview = {
  from: string;
  replyTo: string | null;
  replyToIsContactEmail: boolean;
  withEmailCount: number;
  noEmailCount: number;
  totalOutstandingCents: number;
};

type AutoSettings = { enabled: boolean; days: number[]; lastRunOn: string | null; attachStatement: boolean };
const AUTO_DAY_CHOICES = Array.from({ length: 28 }, (_, i) => i + 1);

function RemindersPageInner() {
  const { organizationId, organizationName, permissions, currencyCode } = useOrg();
  const canSend = permissions.includes("SEND_REMINDERS");
  const canHandleSendAll = permissions.includes("VIEW_MONEY");
  const { confirm, dialog } = useConfirmDialog();
  const searchParams = useSearchParams();
  const filterParam = searchParams.get("filter"); // "sent" | "unsent" | null
  const [filter, setFilter] = useState<"all" | "sent" | "unsent">(
    filterParam === "sent" || filterParam === "unsent" ? filterParam : "all"
  );

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editedMessages, setEditedMessages] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const [preview, setPreview] = useState<SendPreview | null>(null);
  const [auto, setAuto] = useState<AutoSettings | null>(null);
  const [autoDraft, setAutoDraft] = useState<AutoSettings | null>(null);
  const [autoSaving, setAutoSaving] = useState(false);
  const [autoMsg, setAutoMsg] = useState<string | null>(null);
  const [sendBusy, setSendBusy] = useState(false);
  // Children ticked for "Email selected" (only those with a parent email).
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<string | null>(null);

  // Message template (customizable wording, with {{childName}}/
  // {{parentName}}/{{amount}}/{{schoolName}} placeholders). null = not
  // loaded yet, in which case each card falls back to the server-computed
  // r.message so there's no flash of "wrong" text while this loads.
  const [templateBody, setTemplateBody] = useState<string | null>(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [templateSaved, setTemplateSaved] = useState(false);
  const canEditTemplate = permissions.includes("VIEW_MONEY");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/organizations/${organizationId}/reminders`);
    const data = await res.json().catch(() => ({}));
    if (res.ok) setReminders(data.reminders);
    else setError(data.error ?? "Could not load reminders.");
    setLoading(false);
  }, [organizationId]);

  const loadPreview = useCallback(async () => {
    const res = await fetch(`/api/organizations/${organizationId}/reminders/send-all`);
    const data = await res.json().catch(() => ({}));
    if (res.ok) setPreview(data.preview);
  }, [organizationId]);

  const loadAuto = useCallback(async () => {
    const res = await fetch(`/api/organizations/${organizationId}/reminders/auto`);
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setAuto(data);
      setAutoDraft(data);
    }
  }, [organizationId]);

  const loadTemplate = useCallback(async () => {
    const res = await fetch(`/api/organizations/${organizationId}/reminders/template`);
    const data = await res.json().catch(() => ({}));
    if (res.ok) setTemplateBody(data.template);
    else setTemplateError(data.error ?? "Couldn't load your reminder message.");
  }, [organizationId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    load();
    loadPreview();
    loadAuto();
    loadTemplate();
  }, [load, loadPreview, loadAuto, loadTemplate]);

  function applyBuiltInTemplate(id: string) {
    const t = REMINDER_TEMPLATES.find((t) => t.id === id);
    if (t) {
      setTemplateBody(t.body);
      setTemplateError(null);
      setTemplateSaved(false);
    }
  }

  async function saveTemplate() {
    if (templateBody === null) return;
    const missing = missingRequiredPlaceholders(templateBody);
    if (missing.length > 0) {
      setTemplateError(`Your message must include ${missing.join(", ")}.`);
      return;
    }
    setTemplateSaving(true);
    setTemplateError(null);
    setTemplateSaved(false);
    try {
      const res = await fetch(`/api/organizations/${organizationId}/reminders/template`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: templateBody }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTemplateError(data.error ?? "Could not save this template.");
        return;
      }
      setTemplateBody(data.template);
      setTemplateSaved(true);
    } finally {
      setTemplateSaving(false);
    }
  }

  const selectedTemplateId =
    REMINDER_TEMPLATES.find((t) => t.body === templateBody)?.id ?? "custom";

  async function sendAll(onlySelected: boolean | string[] = false) {
    if (!preview) return;
    const childIds = Array.isArray(onlySelected)
      ? onlySelected
      : onlySelected
        ? Array.from(selected)
        : undefined;
    const n = childIds ? childIds.length : preview.withEmailCount;
    const confirmed = await confirm({
      title: `Email ${n} parent${n === 1 ? "" : "s"} now?`,
      description:
        (Array.isArray(onlySelected)
          ? `This parent gets your reminder message by email, from ${preview.from}. `
          : childIds
          ? `Only the ${n} parent${n === 1 ? "" : "s"} you ticked get${n === 1 ? "s" : ""} your reminder message by email, from ${preview.from}. `
          : `Each parent who owes money gets your reminder message by email, from ${preview.from}. `) +
        (preview.replyTo ? `If they reply, it goes to ${preview.replyTo}. ` : "") +
        (auto?.attachStatement ? "Each email includes that family's statement as a PDF. " : "") +
        "Check that this month's payments are all recorded first.",
      confirmLabel: `Send ${n} email${n === 1 ? "" : "s"}`,
    });
    if (!confirmed) return;
    setSendBusy(true);
    setSendError(null);
    setSendResult(null);
    try {
      const res = await fetch(`/api/organizations/${organizationId}/reminders/send-all`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(childIds ? { childIds } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSendError(data.error ?? "The reminders couldn't be sent. Please try again.");
        return;
      }
      const r = data.result;
      setSendResult(
        `Sent ${r.sentCount} reminder email${r.sentCount === 1 ? "" : "s"}.` +
          (r.noEmailCount ? ` ${r.noEmailCount} parent${r.noEmailCount === 1 ? " has" : "s have"} no email on file; use WhatsApp below.` : "") +
          (r.failedCount ? ` ${r.failedCount} didn't send${r.firstError ? `: ${r.firstError}` : "."}` : "")
      );
      if (childIds && !Array.isArray(onlySelected)) setSelected(new Set());
      await Promise.all([load(), loadPreview()]);
    } catch {
      setSendError("The reminders couldn't be sent. Check your connection and try again.");
    } finally {
      setSendBusy(false);
    }
  }

  async function setAttachStatement(value: boolean) {
    if (!auto) return;
    const prev = auto;
    setAuto({ ...auto, attachStatement: value });
    setAutoDraft((d) => (d ? { ...d, attachStatement: value } : d));
    const res = await fetch(`/api/organizations/${organizationId}/reminders/auto`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: prev.enabled, days: prev.days, attachStatement: value }),
    });
    if (!res.ok) {
      setAuto(prev);
      setAutoDraft((d) => (d ? { ...d, attachStatement: prev.attachStatement } : d));
      setSendError("Couldn't save that setting. Please try again.");
    }
  }

  async function saveAuto(next: AutoSettings) {
    setAutoSaving(true);
    setAutoMsg(null);
    try {
      const res = await fetch(`/api/organizations/${organizationId}/reminders/auto`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next.enabled, days: next.days, attachStatement: next.attachStatement }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAutoMsg(data.error ?? "Couldn't save. Please try again.");
        return;
      }
      setAuto(data);
      setAutoDraft(data);
      setAutoMsg(data.enabled ? "Saved. Automatic reminders are on." : "Saved. Automatic reminders are off.");
    } finally {
      setAutoSaving(false);
    }
  }

  async function markSent(childId: string, channel: "whatsapp" | "email" | "manual") {
    setBusyId(childId);
    setError(null);
    try {
      const res = await fetch(`/api/organizations/${organizationId}/reminders/${childId}/mark-sent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "That reminder couldn't be marked as sent. Please try again.");
        return;
      }
      await load();
    } catch {
      setError("That reminder couldn't be marked as sent — check your connection and try again.");
    } finally {
      setBusyId(null);
    }
  }

  function messageFor(r: Reminder) {
    if (editedMessages[r.childId] !== undefined) return editedMessages[r.childId];
    if (templateBody === null) return r.message;
    return renderReminderTemplate(templateBody, {
      schoolName: organizationName,
      parentName: r.parentName,
      childName: r.childName,
      amount: formatMoneyCents(r.outstandingCents, currencyCode),
    });
  }

  const visibleReminders = reminders.filter((r) => {
    if (filter === "sent") return Boolean(r.lastReminderSentAt);
    if (filter === "unsent") return !r.lastReminderSentAt;
    return true;
  });

  async function copyMessage(r: Reminder) {
    try {
      await navigator.clipboard.writeText(messageFor(r));
    } catch {
      // Clipboard API can fail (e.g. no permission) — not worth a hard error
      // for what's a convenience shortcut; the text is still selectable in
      // the textarea below.
    }
  }

  // Fallback for the "Email" mailto: link, which does nothing at all —
  // silently, no error — on any device without a default mail app
  // configured. Copies just the address, so it can be pasted straight
  // into Gmail/webmail/whatever the person actually uses.
  const [copiedEmailId, setCopiedEmailId] = useState<string | null>(null);
  async function copyEmailAddress(r: Reminder) {
    if (!r.parentEmail) return;
    try {
      await navigator.clipboard.writeText(r.parentEmail);
      setCopiedEmailId(r.childId);
      setTimeout(() => setCopiedEmailId((id) => (id === r.childId ? null : id)), 2000);
    } catch {
      // Same reasoning as copyMessage above — not worth a hard error.
    }
  }

  if (!canHandleSendAll) {
    // canHandleSendAll === permissions.includes("VIEW_MONEY") here -- the
    // reminders list shows exactly what each parent owes, so it needs the
    // same gate as Payments. A role with SEND_REMINDERS but not VIEW_MONEY
    // (e.g. MANAGER by default) can still mark things sent from elsewhere
    // once Centre Management grows its own reminders view -- not built yet.
    return (
      <p className="text-sm text-muted-foreground">
        You don&apos;t have permission to view reminders. Ask an admin.
      </p>
    );
  }

  return (
    <div className="animate-in">
      <PageHeader
        title="Payment reminders"
        description="Every child with an outstanding balance. Email everyone at once with Send all reminders, turn on automatic reminders, or send one at a time on WhatsApp or email with the message pre-filled."
      />

      {dialog}

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      {canEditTemplate && (
        <Card className="mb-4 p-4">
          <button
            type="button"
            onClick={() => setTemplateOpen((v) => !v)}
            className="flex w-full items-center justify-between text-left"
          >
            <span className="text-sm font-medium text-foreground">Message template</span>
            <span className="text-xs text-muted-foreground">
              {templateOpen ? "Hide" : "Customize the wording used below"}
            </span>
          </button>
          {templateOpen && (
            <div className="animate-in mt-3 flex flex-col gap-3">
              <div className="flex flex-wrap gap-1.5">
                {REMINDER_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => applyBuiltInTemplate(t.id)}
                    className={`transition-standard rounded-lg px-2.5 py-1 text-xs font-medium ${
                      selectedTemplateId === t.id
                        ? "bg-brand-soft text-brand-soft-foreground"
                        : "bg-background text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
                {selectedTemplateId === "custom" && (
                  <span className="rounded-lg bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand-soft-foreground">
                    Custom
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Write it however you like — {"{{childName}}"}, {"{{parentName}}"}, and{" "}
                {"{{amount}}"} must always appear somewhere in the message; {"{{schoolName}}"} is
                available too but optional.
              </p>
              <Textarea
                rows={4}
                value={templateBody ?? DEFAULT_REMINDER_TEMPLATE}
                onChange={(e) => {
                  setTemplateBody(e.target.value);
                  setTemplateSaved(false);
                }}
              />
              <div className="flex items-center gap-3">
                <Button size="sm" onClick={saveTemplate} disabled={templateSaving}>
                  {templateSaving ? "Saving…" : "Save as default"}
                </Button>
                {templateSaved && (
                  <span className="text-xs text-success">
                    Saved — this is now the default for everyone in your school.
                  </span>
                )}
              </div>
              {templateError && <p className="text-xs text-danger">{templateError}</p>}
            </div>
          )}
        </Card>
      )}

      {canHandleSendAll && (
        <Card className="mb-4 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Send all reminders by email</p>
              <p className="text-xs text-muted-foreground">
                {preview
                  ? preview.withEmailCount > 0
                    ? `${preview.withEmailCount} parent${preview.withEmailCount === 1 ? "" : "s"} with an email owe ${formatCents(preview.totalOutstandingCents, currencyCode)} in total.` +
                      (preview.noEmailCount ? ` ${preview.noEmailCount} more have no email; use WhatsApp for them below.` : "")
                    : "No parent who owes money has an email on file. Use WhatsApp below."
                  : "Checking who owes…"}
              </p>
              {preview && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Parents see it from <span className="font-medium text-foreground">{preview.from}</span>
                  {preview.replyTo ? (
                    <>
                      ; replies go to <span className="font-medium text-foreground">{preview.replyTo}</span>
                    </>
                  ) : null}
                  .{" "}
                  {!preview.replyToIsContactEmail && (
                    <a href="settings/general" className="text-brand underline underline-offset-2">
                      Set your school&apos;s contact email
                    </a>
                  )}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {selected.size > 0 && (
                <Button size="sm" onClick={() => sendAll(true)} disabled={sendBusy || !preview}>
                  {sendBusy ? "Sending…" : `Email ${selected.size} selected`}
                </Button>
              )}
              <Button
                size="sm"
                variant={selected.size > 0 ? "secondary" : "primary"}
                onClick={() => sendAll(false)}
                disabled={sendBusy || !preview || preview.withEmailCount === 0}
              >
                {sendBusy && selected.size === 0 ? "Sending…" : "Send all reminders"}
              </Button>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Only want to remind a few? Tick them in the list below, then use Email selected.{" "}
            {reminders.some((r) => r.parentEmail) && (
              <>
                <button
                  type="button"
                  className="text-brand underline underline-offset-2"
                  onClick={() => setSelected(new Set(visibleReminders.filter((r) => r.parentEmail).map((r) => r.childId)))}
                >
                  Select all shown
                </button>
                {selected.size > 0 && (
                  <>
                    {" · "}
                    <button type="button" className="text-brand underline underline-offset-2" onClick={() => setSelected(new Set())}>
                      Clear selection
                    </button>
                  </>
                )}
              </>
            )}
          </p>
          {auto && (
            <label className="mt-3 flex items-center gap-2 text-sm text-foreground">
              <input
                id="attach-statement"
                type="checkbox"
                checked={auto.attachStatement}
                onChange={(e) => setAttachStatement(e.target.checked)}
                disabled={sendBusy}
              />
              Attach each family&apos;s statement (PDF)
            </label>
          )}
          {sendBusy && auto?.attachStatement && (
            <p className="mt-2 text-xs text-muted-foreground">
              Sending one by one with statements attached. This can take up to a minute; keep this page open.
            </p>
          )}
          {sendResult && <p className="mt-2 text-sm text-success">{sendResult}</p>}
          {sendError && <p className="mt-2 text-xs text-danger">{sendError}</p>}
        </Card>
      )}

      {canHandleSendAll && autoDraft && (
        <Card className="mb-4 p-4">
          <label className="flex items-start gap-3">
            <input
              id="auto-enabled"
              type="checkbox"
              className="mt-1"
              checked={autoDraft.enabled}
              onChange={(e) => setAutoDraft({ ...autoDraft, enabled: e.target.checked })}
            />
            <span>
              <span className="block text-sm font-medium text-foreground">Automatic reminders</span>
              <span className="block text-xs text-muted-foreground">
                On the days you pick, Crechely emails every parent who still owes at 07:00. Anyone
                reminded in the last 2 days is skipped.
              </span>
            </span>
          </label>
          {autoDraft.enabled && (
            <div className="mt-3 flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">Days of the month</p>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Days of the month">
                {AUTO_DAY_CHOICES.map((d) => {
                  const on = autoDraft.days.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setAutoDraft({
                          ...autoDraft,
                          days: on ? autoDraft.days.filter((x) => x !== d) : [...autoDraft.days, d].sort((a, b) => a - b),
                        })
                      }
                      className={`transition-standard h-8 w-8 rounded-lg text-xs font-medium tabular-nums ${
                        on ? "bg-brand text-brand-foreground" : "bg-background text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => saveAuto(autoDraft)}
              disabled={autoSaving || JSON.stringify(autoDraft) === JSON.stringify(auto)}
            >
              {autoSaving ? "Saving…" : "Save"}
            </Button>
            {autoMsg && <span className="text-xs text-muted-foreground">{autoMsg}</span>}
            {auto?.lastRunOn && <span className="text-xs text-muted-foreground">Last automatic run: {auto.lastRunOn}</span>}
          </div>
        </Card>
      )}

      {!loading && reminders.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2 text-sm">
          {(["all", "unsent", "sent"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`transition-standard rounded-lg px-3 py-1.5 font-medium ${
                filter === f
                  ? "bg-brand-soft text-brand-soft-foreground"
                  : "bg-surface text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "all" ? "All" : f === "unsent" ? "Never reminded" : "Already reminded"}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : reminders.length === 0 ? (
        <EmptyState
          title="No outstanding balances"
          description="Nothing to remind."
        />
      ) : visibleReminders.length === 0 ? (
        <EmptyState
          title="Nothing here"
          description={filter === "sent" ? "No one has been reminded yet." : "Everyone owing has already been reminded."}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {visibleReminders.map((r) => (
            <Card key={r.childId} as="div" className="p-4">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <div className="flex items-baseline gap-2">
                  {canHandleSendAll && r.parentEmail && (
                    <input
                      id={`sel-${r.childId}`}
                      type="checkbox"
                      className="self-center"
                      aria-label={`Select ${r.childName} to email`}
                      checked={selected.has(r.childId)}
                      onChange={(e) =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(r.childId);
                          else next.delete(r.childId);
                          return next;
                        })
                      }
                    />
                  )}
                  <span className="font-medium text-foreground">{r.childName}</span>
                  <span className="ml-2 text-sm text-muted-foreground">{r.categoryName}</span>
                </div>
                <span className="font-medium text-danger">
                  {formatCents(r.outstandingCents, currencyCode)} outstanding
                </span>
              </div>
              <p className="mb-2 text-sm text-muted-foreground">
                {r.parentName}
                {r.parentPhone ? ` · ${r.parentPhone}` : ""}
                {r.parentEmail ? ` · ${r.parentEmail}` : ""}
                {!r.parentPhone && !r.parentEmail && " · no contact details on file"}
              </p>
              <Textarea
                className="mb-2"
                rows={3}
                value={messageFor(r)}
                onChange={(e) =>
                  setEditedMessages((m) => ({ ...m, [r.childId]: e.target.value }))
                }
              />
              {r.lastReminderSentAt && (
                <p className="mb-2 text-xs text-muted-foreground">
                  Last reminded {formatDateZA(r.lastReminderSentAt)}
                </p>
              )}
              {canSend && (
                <div className="flex flex-wrap gap-2 text-sm">
                  {r.parentPhone && (
                    <a
                      href={waLink(r.parentPhone, messageFor(r))}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => markSent(r.childId, "whatsapp")}
                      className="transition-standard inline-flex items-center justify-center gap-2 rounded-lg bg-success px-3 py-1.5 font-medium text-white hover:brightness-95"
                    >
                      WhatsApp
                    </a>
                  )}
                  {r.parentEmail && canHandleSendAll && (
                    <Button size="sm" onClick={() => sendAll([r.childId])} disabled={sendBusy || !preview}>
                      Send email
                    </Button>
                  )}
                  {r.parentEmail && (
                    <a
                      href={mailLink(r.parentEmail, messageFor(r))}
                      onClick={() => markSent(r.childId, "email")}
                      title="Opens your own email program (Outlook, Mail…) with this message typed in. You press send there yourself."
                      className="transition-standard inline-flex items-center justify-center gap-2 rounded-lg border border-border-strong bg-surface px-3 py-1.5 font-medium text-foreground hover:bg-background"
                    >
                      Open in my email app
                    </a>
                  )}
                  {r.parentEmail && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => copyEmailAddress(r)}
                      title="Copy the parent's address to paste into Gmail or webmail yourself."
                    >
                      {copiedEmailId === r.childId ? "Copied!" : "Copy email address"}
                    </Button>
                  )}
                  <Button variant="secondary" size="sm" onClick={() => copyMessage(r)}>
                    Copy message
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => markSent(r.childId, "manual")}
                    disabled={busyId === r.childId}
                  >
                    Mark as sent
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
