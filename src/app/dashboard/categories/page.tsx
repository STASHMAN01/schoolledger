"use client";

import { useCallback, useEffect, useState } from "react";
import { useOrg, canManage } from "../OrgContext";
import { Button, Card, Input, Label, PageHeader, Select } from "@/components/ui";
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

function buildTree(categories: Category[], parentId: string | null): Category[] {
  return categories.filter((c) => c.parentId === parentId);
}

export default function CategoriesPage() {
  const { organizationId, role, currencyCode } = useOrg();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string>("");
  const [fee, setFee] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/organizations/${organizationId}/categories`);
    const data = await res.json();
    if (res.ok) setCategories(data.categories);
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
        name,
        parentId: parentId || null,
        monthlyFeeCents: inputToCents(fee),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not add category.");
      return;
    }
    setName("");
    setFee("");
    await load();
  }

  async function toggleArchive(category: Category) {
    if (!category.archived) {
      const confirmed = await confirm({
        title: "Archive this category?",
        description: `"${category.name}" will be hidden from the active category list (its children and history are kept, and you can restore it any time).`,
        confirmLabel: "Archive",
        variant: "danger",
      });
      if (!confirmed) return;
    }
    const url = category.archived
      ? `/api/organizations/${organizationId}/categories/${category.id}/restore`
      : `/api/organizations/${organizationId}/categories/${category.id}`;
    await fetch(url, { method: category.archived ? "POST" : "DELETE" });
    await load();
  }

  function renderNode(category: Category, depth: number) {
    const children = buildTree(categories, category.id);
    if (category.archived && !showArchived) return null;
    return (
      <div key={category.id}>
        <div
          className="flex items-center justify-between border-b border-border py-2 px-4 last:border-b-0"
          style={{ paddingLeft: depth * 20 + 16 }}
        >
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
          {canManage(role) && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => toggleArchive(category)}
                className="text-xs text-muted-foreground underline transition-standard hover:text-foreground"
              >
                {category.archived ? "Restore" : "Archive"}
              </button>
              <DeletionControl
                organizationId={organizationId}
                targetType="CATEGORY"
                targetId={category.id}
                targetLabel={category.name}
                deletionRequest={category.deletionRequest}
                canRequest={canManage(role)}
                isAdmin={role === "ADMIN"}
                onChanged={load}
                confirm={confirm}
              />
            </div>
          )}
        </div>
        {children.map((c) => renderNode(c, depth + 1))}
      </div>
    );
  }

  const roots = buildTree(categories, null);
  const activeCategories = categories.filter((c) => !c.archived);

  return (
    <div className="animate-in">
      {confirmDialog}
      <PageHeader
        title="Categories"
        actions={
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Show archived
          </label>
        }
      />

      {canManage(role) && (
        <Card as="div" className="mb-8 p-4">
          <form onSubmit={addCategory} className="flex flex-wrap items-end gap-3">
            <Label className="flex flex-col gap-1">
              Name
              <Input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Daycare, or Ducks Class"
              />
            </Label>
            <Label className="flex flex-col gap-1">
              Parent category (optional)
              <Select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
              >
                <option value="">None (top level)</option>
                {activeCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
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
            <Button type="submit">Add category</Button>
          </form>
        </Card>
      )}

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : roots.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No categories yet. Add your first one above — e.g. &quot;Daycare&quot;,
          then add sub-categories like &quot;Ducks Class&quot; underneath it.
        </p>
      ) : (
        <Card>
          {roots.map((c) => renderNode(c, 0))}
        </Card>
      )}
    </div>
  );
}
