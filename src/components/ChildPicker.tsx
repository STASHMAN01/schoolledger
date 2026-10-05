"use client";

import { useState } from "react";
import { Input } from "@/components/ui";

export type PickableChild = {
  id: string;
  firstName: string;
  lastName: string;
  category?: { name: string } | null;
};

/**
 * Choose a child on a phone or tablet: a search box over a list of big,
 * tappable rows, instead of a tiny native drop-down that runs off the
 * screen. Once chosen it collapses to a single line with a Change button.
 */
export function ChildPicker({
  options: kids,
  value,
  onChange,
  disabled,
}: {
  options: PickableChild[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const chosen = kids.find((c) => c.id === value);

  if (chosen && !open) {
    return (
      <div className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-border-strong bg-surface px-3 py-2">
        <span className="min-w-0 break-words text-base font-medium text-foreground sm:text-sm">
          {chosen.firstName} {chosen.lastName}
          {chosen.category?.name && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">{chosen.category.name}</span>
          )}
        </span>
        {!disabled && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setOpen(true);
            }}
            className="min-h-10 shrink-0 px-2 text-sm font-medium text-brand underline underline-offset-2"
          >
            Change
          </button>
        )}
      </div>
    );
  }

  const q = query.trim().toLowerCase();
  const matches = kids
    .filter((c) => !q || `${c.firstName} ${c.lastName}`.toLowerCase().includes(q))
    .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));

  return (
    <div className="rounded-lg border border-border-strong bg-surface">
      <div className="border-b border-border p-2">
        <Input
          type="search"
          inputMode="search"
          autoComplete="off"
          placeholder={`Search ${kids.length} children by name`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search children"
        />
      </div>
      <div className="max-h-56 overflow-y-auto overscroll-contain">
        {matches.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">
            {kids.length === 0 ? "No children in your class yet." : "No child matches that name."}
          </p>
        ) : (
          matches.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onChange(c.id);
                setOpen(false);
              }}
              className="flex min-h-12 w-full items-center justify-between gap-3 border-b border-border px-3 py-2 text-left last:border-b-0 hover:bg-background active:bg-background"
            >
              <span className="min-w-0 break-words text-base text-foreground sm:text-sm">
                {c.firstName} {c.lastName}
              </span>
              {c.category?.name && <span className="shrink-0 text-xs text-muted-foreground">{c.category.name}</span>}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
