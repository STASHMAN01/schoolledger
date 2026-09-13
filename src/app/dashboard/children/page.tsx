"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useOrg, canManage } from "../OrgContext";

type Category = { id: string; name: string; archived: boolean };
type Child = {
  id: string;
  firstName: string;
  lastName: string;
  parentName: string;
  parentPhone: string | null;
  parentEmail: string | null;
  enrollmentDate: string;
  exitDate: string | null;
  archived: boolean;
  category: { id: string; name: string };
};

const emptyForm = {
  categoryId: "",
  firstName: "",
  lastName: "",
  parentName: "",
  parentPhone: "",
  parentEmail: "",
  enrollmentDate: "",
};

export default function ChildrenPage() {
  const { organizationId, role } = useOrg();
  const [categories, setCategories] = useState<Category[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [filterCategory, setFilterCategory] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [siblingNotice, setSiblingNotice] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    const res = await fetch(`/api/organizations/${organizationId}/categories`);
    const data = await res.json();
    if (res.ok) setCategories(data.categories.filter((c: Category) => !c.archived));
  }, [organizationId]);

  const loadChildren = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterCategory) params.set("categoryId", filterCategory);
    if (showArchived) params.set("archived", "true");
    const res = await fetch(
      `/api/organizations/${organizationId}/children?${params.toString()}`
    );
    const data = await res.json();
    if (res.ok) setChildren(data.children);
    setLoading(false);
  }, [organizationId, filterCategory, showArchived]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount, standard pattern
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reload when org/filters change, standard pattern
    loadChildren();
  }, [loadChildren]);

  async function addChild(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSiblingNotice(null);
    const res = await fetch(`/api/organizations/${organizationId}/children`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not add child. Check phone/email format.");
      return;
    }
    const siblings = (data.possibleSiblings as { id: string }[]).filter(
      (s) => s.id !== data.child.id
    );
    if (siblings.length > 0) {
      setSiblingNotice(
        `Note: there ${siblings.length === 1 ? "is" : "are"} already ${
          siblings.length
        } other child${siblings.length === 1 ? "" : "ren"} with the surname "${
          form.lastName
        }" — joint parent statements are a later phase, but flagging it now.`
      );
    }
    setForm(emptyForm);
    await loadChildren();
  }

  async function toggleArchive(child: Child) {
    const url = child.archived
      ? `/api/organizations/${organizationId}/children/${child.id}/restore`
      : `/api/organizations/${organizationId}/children/${child.id}`;
    await fetch(url, { method: child.archived ? "POST" : "DELETE" });
    await loadChildren();
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Children</h1>

      {canManage(role) && (
        <form
          onSubmit={addChild}
          className="mb-8 grid grid-cols-1 gap-3 rounded border border-neutral-200 p-4 sm:grid-cols-2"
        >
          <label className="flex flex-col gap-1 text-sm">
            Category
            <select
              required
              className="rounded border border-neutral-300 px-3 py-2"
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            >
              <option value="">Select a category...</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Enrollment date
            <input
              required
              type="date"
              className="rounded border border-neutral-300 px-3 py-2"
              value={form.enrollmentDate}
              onChange={(e) => setForm({ ...form, enrollmentDate: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            First name
            <input
              required
              className="rounded border border-neutral-300 px-3 py-2"
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Last name
            <input
              required
              className="rounded border border-neutral-300 px-3 py-2"
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Parent/guardian name
            <input
              required
              className="rounded border border-neutral-300 px-3 py-2"
              value={form.parentName}
              onChange={(e) => setForm({ ...form, parentName: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Parent phone (e.g. +27821234567)
            <input
              className="rounded border border-neutral-300 px-3 py-2"
              value={form.parentPhone}
              onChange={(e) => setForm({ ...form, parentPhone: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            Parent email
            <input
              type="email"
              className="rounded border border-neutral-300 px-3 py-2"
              value={form.parentEmail}
              onChange={(e) => setForm({ ...form, parentEmail: e.target.value })}
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded bg-neutral-900 px-4 py-2 text-white"
            >
              Add child
            </button>
          </div>
        </form>
      )}

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {siblingNotice && (
        <p className="mb-4 text-sm text-amber-700">{siblingNotice}</p>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <select
          className="rounded border border-neutral-300 px-3 py-2 text-sm"
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-neutral-500">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Show archived only
        </label>
      </div>

      {loading ? (
        <p className="text-sm text-neutral-500">Loading...</p>
      ) : children.length === 0 ? (
        <p className="text-sm text-neutral-500">No children found.</p>
      ) : (
        <div className="overflow-x-auto rounded border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Parent</th>
                <th className="px-3 py-2">Enrolled</th>
                {canManage(role) && <th className="px-3 py-2"></th>}
              </tr>
            </thead>
            <tbody>
              {children.map((c) => (
                <tr key={c.id} className="border-t border-neutral-100">
                  <td className="px-3 py-2">
                    <Link
                      href={`/dashboard/children/${c.id}`}
                      className="text-neutral-900 underline"
                    >
                      {c.firstName} {c.lastName}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{c.category.name}</td>
                  <td className="px-3 py-2">{c.parentName}</td>
                  <td className="px-3 py-2">
                    {new Date(c.enrollmentDate).toLocaleDateString()}
                  </td>
                  {canManage(role) && (
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => toggleArchive(c)}
                        className="text-xs text-neutral-500 underline"
                      >
                        {c.archived ? "Restore" : "Archive"}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
