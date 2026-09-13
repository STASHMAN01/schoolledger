export type LeafRow = {
  categoryId: string;
  categoryName: string;
  paymentTypeId: string;
  paymentTypeName: string;
  childId: string;
  childName: string;
  amountCents: number;
};

export type ChildNode = { childId: string; name: string; amountCents: number };
export type PaymentTypeNode = {
  paymentTypeId: string;
  name: string;
  amountCents: number;
  children: ChildNode[];
};
export type CategoryNode = {
  categoryId: string;
  name: string;
  amountCents: number;
  paymentTypes: PaymentTypeNode[];
};

/**
 * Groups flat (category, paymentType, child, amount) rows into the
 * three-level drill-down tree the home dashboard renders: category totals
 * that expand into payment-type totals that expand into the individual
 * children behind that number. Zero-amount rows are dropped — an entry
 * with nothing outstanding shouldn't clutter the drill-down.
 */
export function buildDrilldownTree(rows: LeafRow[]): CategoryNode[] {
  const categories = new Map<string, CategoryNode>();

  for (const row of rows) {
    if (row.amountCents <= 0) continue;

    let category = categories.get(row.categoryId);
    if (!category) {
      category = {
        categoryId: row.categoryId,
        name: row.categoryName,
        amountCents: 0,
        paymentTypes: [],
      };
      categories.set(row.categoryId, category);
    }
    category.amountCents += row.amountCents;

    let paymentType = category.paymentTypes.find((p) => p.paymentTypeId === row.paymentTypeId);
    if (!paymentType) {
      paymentType = {
        paymentTypeId: row.paymentTypeId,
        name: row.paymentTypeName,
        amountCents: 0,
        children: [],
      };
      category.paymentTypes.push(paymentType);
    }
    paymentType.amountCents += row.amountCents;

    let child = paymentType.children.find((c) => c.childId === row.childId);
    if (!child) {
      child = { childId: row.childId, name: row.childName, amountCents: 0 };
      paymentType.children.push(child);
    }
    child.amountCents += row.amountCents;
  }

  const tree = Array.from(categories.values());
  tree.sort((a, b) => b.amountCents - a.amountCents);
  for (const c of tree) {
    c.paymentTypes.sort((a, b) => b.amountCents - a.amountCents);
    for (const p of c.paymentTypes) {
      p.children.sort((a, b) => b.amountCents - a.amountCents);
    }
  }
  return tree;
}
