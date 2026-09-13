"use client";

import { useCallback, useEffect, useState } from "react";
import { useOrg, canManage } from "../OrgContext";

type Category = {
  id: string;
  name: string;
  parentId: string | null;
  monthlyFeeCents: number | null;
  archived: boolean;
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
  const { organizationId, role } = useOrg();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

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
          className="flex items-center justify-between border-b border-neutral-100 py-2"
          style={{ paddingLeft: depth * 20 }}
        >
          <div>
            <span className={category.archived ? "text-neutral-400 line-through" : ""}>
              {category.name}
            </span>
            {category.monthlyFeeCents !== null && (
              <span className="ml-2 text-xs text-neutral-500">
                R{(category.monthlyFeeCents / 100).toFixed(2)}/mo
              </span>
            )}
          </div>
          {canManage(role) && (
            <button
              onClick={() => toggleArchive(category)}
              className="text-xs text-neutral-500 underline"
            >
              {category.archived ? "Restore" : "Archive"}
            </button>
          )}
        </div>
        {children.map((c) => renderNode(c, depth + 1))}
      </div>
    );
  }

  const roots = buildTree(categories, null);
  const activeCategories = categories.filter((c) => !c.archived);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Categories</h1>
        <label className="flex items-center gap-2 text-sm text-neutral-500">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Show archived
        </label>
      </div>

      {canManage(role) && (
        <form
          onSubmit={addCategory}
          className="mb-8 flex flex-wrap items-end gap-3 rounded border border-neutral-200 p-4"
        >
          <label className="flex flex-col gap-1 text-sm">
            Name
            <input
              required
              className="rounded border border-neutral-300 px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Daycare, or Ducks Class"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Parent category (optional)
            <select
              className="rounded border border-neutral-300 px-3 py-2"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
            >
              <option value="">None (top level)</option>
              {activeCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Monthly fee (optional)
            <input
              className="w-32 rounded border border-neutral-300 px-3 py-2"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              placeholder="e.g. 1400"
              inputMode="decimal"
            />
          </label>
          <button
            type="submit"
            className="rounded bg-neutral-900 px-4 py-2 text-white"
          >
            Add category
          </button>
        </form>
      )}

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-neutral-500">Loading...</p>
      ) : roots.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No categories yet. Add your first one above — e.g. &quot;Daycare&quot;,
          then add sub-categories like &quot;Ducks Class&quot; underneath it.
        </p>
      ) : (
        <div className="rounded border border-neutral-200">
          {roots.map((c) => renderNode(c, 0))}
        </div>
      )}
    </div>
  );
}
