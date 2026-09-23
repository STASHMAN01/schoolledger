"use client";

import { useCallback, useEffect, useState } from "react";
import { useOrg } from "../../OrgContext";
import { Card, EmptyState, PageHeader, Select } from "@/components/ui";

type Category = { id: string; name: string; archived: boolean };

type ChildRow = {
  id: string;
  firstName: string;
  lastName: string;
  parentName: string;
  parentPhone: string | null;
  addedAt: string | null;
};

export default function CommunicationPage() {
  const { organizationId, role, permissions } = useOrg();
  const isTeacher = role === "TEACHER";
  const canTick = permissions.includes("MANAGE_CHILDREN");

  const [categories, setCategories] = useState<Category[]>([]);
  const [pickedCategoryId, setPickedCategoryId] = useState("");
  const [loadedCategory, setLoadedCategory] = useState<{ id: string; name: string } | null>(null);
  const [children, setChildren] = useState<ChildRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isTeacher) return;
    (async () => {
      const res = await fetch(`/api/organizations/${organizationId}/categories`);
      const data = await res.json();
      if (res.ok) {
        const active = (data.categories as Category[]).filter((c) => !c.archived);
        setCategories(active);
        setPickedCategoryId((prev) => prev || active[0]?.id || "");
        if (active.length === 0) setLoading(false);
      }
    })();
  }, [organizationId, isTeacher]);

  const load = useCallback(
    async (categoryId?: string) => {
      setLoading(true);
      setError("");
      const qs = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : "";
      const res = await fetch(`/api/organizations/${organizationId}/whatsapp-checks${qs}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setLoadedCategory(data.category);
        setChildren(data.children);
      } else {
        setLoadedCategory(null);
        setChildren([]);
        setError(data.error ?? "Could not load the class list.");
      }
      setLoading(false);
    },
    [organizationId]
  );

  useEffect(() => {
    if (!isTeacher && !pickedCategoryId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load + reload when the class changes
    load(isTeacher ? undefined : pickedCategoryId);
  }, [isTeacher, pickedCategoryId, load]);

  async function toggle(child: ChildRow) {
    if (!loadedCategory || !canTick) return;
    const added = !child.addedAt;
    setBusyId(child.id);
    setError("");
    const res = await fetch(`/api/organizations/${organizationId}/whatsapp-checks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ childId: child.id, categoryId: loadedCategory.id, added }),
    });
    setBusyId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not save that change.");
      return;
    }
    setChildren((prev) =>
      prev.map((c) => (c.id === child.id ? { ...c, addedAt: added ? new Date().toISOString() : null } : c))
    );
  }

  const addedCount = children.filter((c) => c.addedAt).length;

  return (
    <div className="animate-in max-w-3xl">
      <PageHeader
        title="Communication"
        description="Keep track of which parents have been added to each class's WhatsApp group. Crechely doesn't connect to WhatsApp. Add them in WhatsApp, then tick them off here."
      />

      {!isTeacher && (
        <Card as="div" className="mb-4 p-4">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Class</label>
          <Select value={pickedCategoryId} onChange={(e) => setPickedCategoryId(e.target.value)} className="max-w-xs">
            {categories.length === 0 && <option value="">No classes yet</option>}
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Card>
      )}

      {error && (
        <p className="mb-4 rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{error}</p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !loadedCategory ? null : children.length === 0 ? (
        <EmptyState title={`No children in ${loadedCategory.name} yet`} />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {addedCount} of {children.length}
            </span>{" "}
            parents added to the {loadedCategory.name} WhatsApp group
          </p>
          <Card className="divide-y divide-border">
            {children.map((c) => (
              <label
                key={c.id}
                className={`flex items-center gap-3 px-4 py-3 text-sm ${canTick ? "cursor-pointer" : ""}`}
              >
                <input
                  type="checkbox"
                  className="h-5 w-5 shrink-0"
                  checked={!!c.addedAt}
                  disabled={!canTick || busyId === c.id}
                  onChange={() => toggle(c)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-foreground">
                    {c.firstName} {c.lastName}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {c.parentName}
                    {c.parentPhone ? ` · ${c.parentPhone}` : ""}
                  </span>
                </span>
                {c.addedAt && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    Added {new Date(c.addedAt).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}
                  </span>
                )}
              </label>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}
