"use client";

import { useCallback, useEffect, useState } from "react";
import { useOrg } from "../../OrgContext";
import { Button, Card, Input, Label, PageHeader } from "@/components/ui";
import { formatCents } from "@/lib/formatMoney";
import { useConfirmDialog } from "@/components/useConfirmDialog";
import { DeletionControl, type DeletionRequestInfo } from "@/components/DeletionControl";

type Category = {
  id: string;
  name: string;
  parentId: string | null;
  monthlyFeeCents: number | null;
  archived: boolean;
  deletionRequest: DeletionRequestInfo | null;
};

function inputToCents(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return null;
  return Math.round(parsed * 100);
}

export default function CategoriesPage() {
  const { organizationId, permissions, currencyCode } = useOrg();
  const canManage = permissions.includes("MANAGE_CLASSES");
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  const [name, setName] = useState("");
  const [fee, setFee] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/organizations/${organizationId}/categories`);
    const data = await res.json().catch(() => ({}));
    if (res.ok) setCategories(data.categories);
    else setError(data.error ?? "Couldn't load classes.");
    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount, standard pattern
    load();
  }, [load]);

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch(`/api/organizations/${organizationId}/categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // Flat list by decision (Phase 1 centre-management restructure) —
        // classes are never nested. The API no longer accepts parentId.
        name,
        monthlyFeeCents: inputToCents(fee),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Could not add class.");
      return;
    }
    setName("");
    setFee("");
    await load();
  }

  async function toggleArchive(category: Category) {
    if (!category.archived) {
      const confirmed = await confirm({
        title: "Archive this class?",
        description: `"${category.name}" will be hidden from the active class list (its children and history are kept, and you can restore it any time).`,
        confirmLabel: "Archive",
        variant: "danger",
      });
      if (!confirmed) return;
    }
    const url = category.archived
      ? `/api/organizations/${organizationId}/categories/${category.id}/restore`
      : `/api/organizations/${organizationId}/categories/${category.id}`;
    const res = await fetch(url, { method: category.archived ? "POST" : "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? `"${category.name}" couldn't be ${category.archived ? "restored" : "archived"}. Please try again.`);
      return;
    }
    await load();
  }

  function renderRow(category: Category) {
    if (category.archived && !showArchived) return null;
    return (
      <div key={category.id}>
        <div className="flex items-center justify-between border-b border-border py-2 px-4 last:border-b-0">
          <div>
            <span className={category.archived ? "text-muted line-through" : "text-foreground"}>
              {category.name}
            </span>
            {category.monthlyFeeCents !== null && (
              <span className="ml-2 text-xs text-muted-foreground">
                {formatCents(category.monthlyFeeCents, currencyCode)}/mo
              </span>
            )}
          </div>
          {canManage && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => toggleArchive(category)}
                className="inline-flex min-h-11 items-center px-1 text-xs text-muted-foreground underline transition-standard hover:text-foreground sm:min-h-0 sm:px-0"
              >
                {category.archived ? "Restore" : "Archive"}
              </button>
              <DeletionControl
                organizationId={organizationId}
                targetType="CATEGORY"
                targetId={category.id}
                targetLabel={category.name}
                deletionRequest={category.deletionRequest}
                canRequest={canManage}
                isAdmin={permissions.includes("APPROVE_DELETION")}
                onChanged={load}
                confirm={confirm}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  const sortedCategories = [...categories].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="animate-in">
      {confirmDialog}
      <PageHeader
        title="Classes"
        actions={
          <label className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              className="h-5 w-5 sm:h-4 sm:w-4"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Show archived
          </label>
        }
      />

      {canManage && (
        <Card as="div" className="mb-8 p-4">
          <form onSubmit={addCategory} className="flex flex-wrap items-end gap-3">
            <Label className="flex w-full flex-col gap-1 sm:w-auto">
              Name
              <Input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Daycare, or Ducks Class"
              />
            </Label>
            <Label className="flex flex-col gap-1">
              Monthly fee (optional)
              <Input
                className="w-32"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                placeholder="e.g. 1400"
                inputMode="decimal"
              />
            </Label>
            <Button type="submit">Add class</Button>
          </form>
        </Card>
      )}

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : sortedCategories.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No classes yet. Add your first one above — e.g. &quot;Butterfly&quot;
          or &quot;Ducks Class&quot;.
        </p>
      ) : (
        <Card>
          {sortedCategories.map((c) => renderRow(c))}
        </Card>
      )}
    </div>
  );
}
