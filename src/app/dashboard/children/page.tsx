"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useOrg, canManage } from "../OrgContext";
import { Button, Card, Input, Label, PageHeader, Select } from "@/components/ui";

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
    <div className="animate-in">
      <PageHeader title="Children" />

      {canManage(role) && (
        <Card as="div" className="mb-8 p-4">
          <form onSubmit={addChild} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Label className="flex flex-col gap-1">
              Category
              <Select
                required
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              >
                <option value="">Select a category...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Label>
            <Label className="flex flex-col gap-1">
              Enrollment date
              <Input
                required
                type="date"
                value={form.enrollmentDate}
                onChange={(e) => setForm({ ...form, enrollmentDate: e.target.value })}
              />
            </Label>
            <Label className="flex flex-col gap-1">
              First name
              <Input
                required
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              />
            </Label>
            <Label className="flex flex-col gap-1">
              Last name
              <Input
                required
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              />
            </Label>
            <Label className="flex flex-col gap-1">
              Parent/guardian name
              <Input
                required
                value={form.parentName}
                onChange={(e) => setForm({ ...form, parentName: e.target.value })}
              />
            </Label>
            <Label className="flex flex-col gap-1">
              Parent phone (e.g. +27821234567)
              <Input
                value={form.parentPhone}
                onChange={(e) => setForm({ ...form, parentPhone: e.target.value })}
              />
            </Label>
            <Label className="flex flex-col gap-1 sm:col-span-2">
              Parent email
              <Input
                type="email"
                value={form.parentEmail}
                onChange={(e) => setForm({ ...form, parentEmail: e.target.value })}
              />
            </Label>
            <div className="sm:col-span-2">
              <Button type="submit">Add child</Button>
            </div>
          </form>
        </Card>
      )}

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}
      {siblingNotice && (
        <p className="mb-4 text-sm text-accent-soft-foreground">{siblingNotice}</p>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <Select
          className="max-w-xs"
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Show archived only
        </label>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : children.length === 0 ? (
        <p className="text-sm text-muted-foreground">No children found.</p>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-background text-left">
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
                <tr key={c.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <Link
                      href={`/dashboard/children/${c.id}`}
                      className="text-foreground underline transition-standard hover:text-brand"
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
                        className="text-xs text-muted-foreground underline transition-standard hover:text-foreground"
                      >
                        {c.archived ? "Restore" : "Archive"}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
