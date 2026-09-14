"use client";

import { useState } from "react";
import Link from "next/link";
import { formatCents } from "@/lib/formatMoney";
import type { CategoryNode } from "@/lib/billing/dashboard";

/**
 * The "outstanding amounts > class > payment type > child" drill-down from
 * the original product spec: a total that expands into categories, which
 * expand into payment types, which expand into the individual children
 * behind that number — each level is just a click, nothing navigates away.
 */
export function DrilldownTree({ tree }: { tree: CategoryNode[] }) {
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());
  const [openTypes, setOpenTypes] = useState<Set<string>>(new Set());

  function toggle(set: Set<string>, setSet: (s: Set<string>) => void, key: string) {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSet(next);
  }

  if (tree.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing here right now.</p>;
  }

  return (
    <div className="divide-y divide-border">
      {tree.map((category) => (
        <div key={category.categoryId}>
          <button
            onClick={() => toggle(openCategories, setOpenCategories, category.categoryId)}
            className="flex w-full items-center justify-between py-2 text-left text-sm text-foreground"
          >
            <span>{category.name}</span>
            <span className="font-medium">{formatCents(category.amountCents)}</span>
          </button>
          {openCategories.has(category.categoryId) && (
            <div className="ml-4 border-l border-border pl-4">
              {category.paymentTypes.map((pt) => (
                <div key={pt.paymentTypeId}>
                  <button
                    onClick={() => toggle(openTypes, setOpenTypes, pt.paymentTypeId)}
                    className="flex w-full items-center justify-between py-2 text-left text-sm text-muted-foreground"
                  >
                    <span>{pt.name}</span>
                    <span>{formatCents(pt.amountCents)}</span>
                  </button>
                  {openTypes.has(pt.paymentTypeId) && (
                    <div className="ml-4 border-l border-border pl-4">
                      {pt.children.map((c) => (
                        <Link
                          key={c.childId}
                          href={`/dashboard/children/${c.childId}`}
                          className="transition-standard flex items-center justify-between py-1.5 text-sm text-muted-foreground hover:text-foreground"
                        >
                          <span className="underline">{c.name}</span>
                          <span>{formatCents(c.amountCents)}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
