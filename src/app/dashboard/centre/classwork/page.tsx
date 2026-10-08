"use client";

import { useCallback, useEffect, useState } from "react";
import { useOrg } from "../../OrgContext";
import { Button, Card, EmptyState, PageHeader, Select, Textarea } from "@/components/ui";
import { useConfirmDialog } from "@/components/useConfirmDialog";
import { PhotoAttachments, type Photo } from "@/components/PhotoAttachments";

// Classwork (Dylan, 5 Oct 2026): the class teacher records what they did
// with the children today. Add-only for teachers; the admin reads it and
// can remove a mistaken entry.

type Entry = {
  id: string;
  date: string;
  description: string;
  createdAt: string;
  createdBy: { name: string };
  photos: Photo[];
};
type Category = { id: string; name: string; archived: boolean };

function prettyDate(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export default function ClassworkPage() {
  const { organizationId, role, permissions } = useOrg();
  const isTeacher = role === "TEACHER";
  const canRemove = !isTeacher && permissions.includes("MANAGE_CLASSES");
  const { confirm, dialog } = useConfirmDialog();

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [className, setClassName] = useState("");
  const [today, setToday] = useState("");
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isTeacher) return;
    (async () => {
      const res = await fetch(`/api/organizations/${organizationId}/categories`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const active = (data.categories as Category[]).filter((c) => !c.archived);
        setCategories(active);
        setCategoryId((prev) => prev || active[0]?.id || "");
        if (active.length === 0) setEntries([]);
      }
    })();
  }, [organizationId, isTeacher]);

  const load = useCallback(async () => {
    const qs = isTeacher ? "" : `?categoryId=${encodeURIComponent(categoryId)}`;
    const res = await fetch(`/api/organizations/${organizationId}/classwork${qs}`);
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setEntries(data.entries);
      setClassName(data.category.name);
      setToday(data.today);
      setError("");
    } else {
      setEntries([]);
      setError(data.error ?? "Could not load classwork.");
    }
  }, [organizationId, isTeacher, categoryId]);

  useEffect(() => {
    if (!isTeacher && !categoryId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load when the class changes
    load();
  }, [isTeacher, categoryId, load]);

  async function add() {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/organizations/${organizationId}/classwork`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: text }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Could not save. Please try again.");
      return;
    }
    setText("");
    load();
  }

  async function remove(id: string) {
    const ok = await confirm({
      title: "Remove this entry?",
      description: "The teacher can't get it back. The removal is recorded in the activity log.",
      confirmLabel: "Remove",
      variant: "danger",
    });
    if (!ok) return;
    const res = await fetch(`/api/organizations/${organizationId}/classwork/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not remove it.");
      return;
    }
    load();
  }

  const byDate = new Map<string, Entry[]>();
  for (const e of entries ?? []) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);

  return (
    <div className="animate-in max-w-3xl">
      {dialog}
      <PageHeader
        title="Classwork"
        description={
          isTeacher
            ? "Record what you did with the children today. Entries can't be changed once added."
            : "What each class has been doing, as recorded by its teacher."
        }
      />

      {!isTeacher && (
        <Card as="div" className="mb-4 p-4">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Class</label>
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="max-w-xs">
            {categories.length === 0 && <option value="">No classes yet</option>}
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Card>
      )}

      {isTeacher && (
        <Card as="div" className="mb-5 p-4">
          <label htmlFor="classwork-text" className="mb-1 block text-sm font-medium text-foreground">
            What did you do with the children today?
          </label>
          <Textarea
            id="classwork-text"
            rows={4}
            maxLength={5000}
            value={text}
            placeholder="e.g. Painted leaves and counted to 10 in groups"
            onChange={(e) => setText(e.target.value)}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Please don&apos;t put medical or private details here.
          </p>
          <div className="mt-3">
            <Button onClick={add} disabled={saving || !text.trim()}>
              {saving ? "Saving…" : "Add to today"}
            </Button>
          </div>
        </Card>
      )}

      {error && (
        <p className="mb-4 rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{error}</p>
      )}

      {entries === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : entries.length === 0 ? (
        <EmptyState
          title={className ? `No classwork recorded for ${className} yet` : "No classwork yet"}
          description="Entries from the last 30 days show here, newest first."
        />
      ) : (
        <div className="space-y-4">
          {[...byDate.entries()].map(([date, list]) => (
            <Card as="div" key={date} className={`p-4 ${date === today ? "border-brand" : ""}`}>
              <h2 className="font-display mb-2 text-sm font-semibold text-foreground">
                {prettyDate(date)}
                {date === today && <span className="ml-2 text-xs font-normal text-brand">Today</span>}
              </h2>
              <div className="divide-y divide-border">
                {list.map((e) => (
                  <div key={e.id} className="flex items-start justify-between gap-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="whitespace-pre-wrap text-sm text-foreground">{e.description}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(e.createdAt).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })} ·{" "}
                        {e.createdBy.name}
                      </p>
                      <PhotoAttachments
                        organizationId={organizationId}
                        kind="CLASSWORK"
                        targetId={e.id}
                        photos={e.photos ?? []}
                        canAdd={isTeacher && date === today}
                        canRemove={canRemove || (isTeacher && date === today)}
                        onChanged={load}
                      />
                    </div>
                    {canRemove && (
                      <button
                        type="button"
                        onClick={() => remove(e.id)}
                        className="shrink-0 text-sm text-danger underline underline-offset-2"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
