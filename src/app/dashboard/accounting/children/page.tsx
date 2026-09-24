"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useOrg } from "../../OrgContext";
import { Card, Input, PageHeader, Select } from "@/components/ui";
import { useConfirmDialog } from "@/components/useConfirmDialog";
import { DeletionControl, type DeletionRequestInfo } from "@/components/DeletionControl";
import { ImportChildrenCsv } from "@/components/ImportChildrenCsv";
import { AddChildForm } from "@/components/AddChildForm";
import { formatDateZA } from "@/lib/date";

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
  deletionRequest: DeletionRequestInfo | null;
};


export default function ChildrenPage() {
  const { organizationId, permissions } = useOrg();
  const canManage = permissions.includes("MANAGE_CHILDREN");
  const [categories, setCategories] = useState<Category[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [filterCategory, setFilterCategory] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [siblingNotice, setSiblingNotice] = useState<string | null>(null);
  // Closed by default — Dylan wants "Add child" to be a dropdown you open,
  // not a form that's always sitting open at the top of the page.
  const [showAddForm, setShowAddForm] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  const loadCategories = useCallback(async () => {
    const res = await fetch(`/api/organizations/${organizationId}/categories`);
    const data = await res.json().catch(() => ({}));
    if (res.ok) setCategories(data.categories.filter((c: Category) => !c.archived));
    else setError(data.error ?? "Couldn't load classes.");
  }, [organizationId]);

  const loadChildren = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterCategory) params.set("categoryId", filterCategory);
    if (showArchived) params.set("archived", "true");
    const res = await fetch(
      `/api/organizations/${organizationId}/children?${params.toString()}`
    );
    const data = await res.json().catch(() => ({}));
    if (res.ok) setChildren(data.children);
    else setError(data.error ?? "Couldn't load children.");
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

  // Client-side name/parent search — cheap and instant since the category
  // filter (and "show archived") already narrow the fetched set to
  // something small, and it avoids a round-trip on every keystroke.
  const searchLower = search.trim().toLowerCase();
  const visibleChildren = searchLower
    ? children.filter((c) =>
        `${c.firstName} ${c.lastName} ${c.parentName}`
          .toLowerCase()
          .includes(searchLower)
      )
    : children;

  async function toggleArchive(child: Child) {
    if (!child.archived) {
      const confirmed = await confirm({
        title: "Archive this child?",
        description: `${child.firstName} ${child.lastName} will be hidden from the active children list. Their payment history is kept, and you can restore them any time.`,
        confirmLabel: "Archive",
        variant: "danger",
      });
      if (!confirmed) return;
    }
    const url = child.archived
      ? `/api/organizations/${organizationId}/children/${child.id}/restore`
      : `/api/organizations/${organizationId}/children/${child.id}`;
    const res = await fetch(url, { method: child.archived ? "POST" : "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? `${child.firstName} couldn't be ${child.archived ? "restored" : "archived"}. Please try again.`);
      return;
    }
    await loadChildren();
  }

  return (
    <div className="animate-in">
      {confirmDialog}
      <PageHeader
        title="Children"
        actions={
          canManage ? (
            <ImportChildrenCsv
              organizationId={organizationId}
              categories={categories}
              onImported={loadChildren}
            />
          ) : undefined
        }
      />

      {canManage && (
        <div className="mb-8">
          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            aria-expanded={showAddForm}
            className="transition-standard flex w-full items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 text-left text-sm font-medium text-foreground hover:bg-background"
          >
            Add child
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`h-4 w-4 shrink-0 transition-standard ${showAddForm ? "rotate-180" : ""}`}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </div>
      )}

      {canManage && showAddForm && (
        // Same form as Centre > Enrolled (core details required, Dylan 23
        // Sept), plus the optional child-specific fee for money roles.
        <AddChildForm
          organizationId={organizationId}
          classes={categories}
          showFee={permissions.includes("VIEW_MONEY")}
          onCancel={() => setShowAddForm(false)}
          onAdded={(_id, siblingCount) => {
            setShowAddForm(false);
            setSiblingNotice(
              siblingCount > 0
                ? `Note: there ${siblingCount === 1 ? "is" : "are"} already ${siblingCount} other child${
                    siblingCount === 1 ? "" : "ren"
                  } with the same surname — check whether they're siblings.`
                : null
            );
            loadChildren();
          }}
        />
      )}

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}
      {siblingNotice && (
        <p className="mb-4 text-sm text-accent-soft-foreground">{siblingNotice}</p>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <Input
          className="max-w-xs"
          type="search"
          placeholder="Search by child or parent name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          className="max-w-xs"
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
        >
          <option value="">All classes</option>
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
      ) : visibleChildren.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {search ? "No children match your search." : "No children found."}
        </p>
      ) : (
        <>
        {/* Phones: one card per child instead of a table that runs off
            the screen (mobile pass, 24 Sept). */}
        <div className="flex flex-col gap-2 sm:hidden">
          {visibleChildren.map((c) => (
            <Card key={c.id} as="div" className="p-3">
              <Link
                href={`/dashboard/accounting/children/${c.id}`}
                className="flex min-h-11 items-center justify-between gap-3 text-base font-medium text-foreground"
              >
                <span className="underline underline-offset-2">
                  {c.firstName} {c.lastName}
                </span>
                <span aria-hidden="true" className="text-muted">›</span>
              </Link>
              <p className="text-sm text-muted-foreground">
                {c.category.name} · since {formatDateZA(c.enrollmentDate)}
              </p>
              <p className="text-sm text-muted-foreground">{c.parentName}</p>
              {canManage && (
                <div className="mt-1 flex flex-wrap items-center justify-end gap-3">
                  <button
                    onClick={() => toggleArchive(c)}
                    className="inline-flex min-h-11 items-center px-1 text-sm text-muted-foreground underline transition-standard hover:text-foreground"
                  >
                    {c.archived ? "Restore" : "Archive"}
                  </button>
                  <DeletionControl
                    organizationId={organizationId}
                    targetType="CHILD"
                    targetId={c.id}
                    targetLabel={`${c.firstName} ${c.lastName}`}
                    deletionRequest={c.deletionRequest}
                    canRequest={permissions.includes("APPROVE_DELETION")}
                    isAdmin={permissions.includes("APPROVE_DELETION")}
                    onChanged={loadChildren}
                    confirm={confirm}
                  />
                </div>
              )}
            </Card>
          ))}
        </div>
        <Card className="hidden overflow-x-auto sm:block">
          <table className="w-full text-sm">
            <thead className="bg-background text-left">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Class</th>
                <th className="px-3 py-2">Parent</th>
                <th className="px-3 py-2">Enrolled</th>
                {canManage && <th className="px-3 py-2"></th>}
              </tr>
            </thead>
            <tbody>
              {visibleChildren.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <Link
                      href={`/dashboard/accounting/children/${c.id}`}
                      className="text-foreground underline transition-standard hover:text-brand"
                    >
                      {c.firstName} {c.lastName}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{c.category.name}</td>
                  <td className="px-3 py-2">{c.parentName}</td>
                  <td className="px-3 py-2">
                    {formatDateZA(c.enrollmentDate)}
                  </td>
                  {canManage && (
                    <td className="px-3 py-2 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <button
                          onClick={() => toggleArchive(c)}
                          className="text-xs text-muted-foreground underline transition-standard hover:text-foreground"
                        >
                          {c.archived ? "Restore" : "Archive"}
                        </button>
                        <DeletionControl
                          organizationId={organizationId}
                          targetType="CHILD"
                          targetId={c.id}
                          targetLabel={`${c.firstName} ${c.lastName}`}
                          deletionRequest={c.deletionRequest}
                          canRequest={permissions.includes("APPROVE_DELETION")}
                          isAdmin={permissions.includes("APPROVE_DELETION")}
                          onChanged={loadChildren}
                          confirm={confirm}
                        />
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        </>
      )}
    </div>
  );
}
