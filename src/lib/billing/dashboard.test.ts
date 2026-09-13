import { describe, it, expect } from "vitest";
import { buildDrilldownTree, type LeafRow } from "./dashboard";

describe("buildDrilldownTree", () => {
  const rows: LeafRow[] = [
    {
      categoryId: "cat-ducks",
      categoryName: "Ducks",
      paymentTypeId: "pt-fees",
      paymentTypeName: "School Fees",
      childId: "c1",
      childName: "Alice A",
      amountCents: 100_000,
    },
    {
      categoryId: "cat-ducks",
      categoryName: "Ducks",
      paymentTypeId: "pt-fees",
      paymentTypeName: "School Fees",
      childId: "c2",
      childName: "Bob B",
      amountCents: 50_000,
    },
    {
      categoryId: "cat-ducks",
      categoryName: "Ducks",
      paymentTypeId: "pt-trip",
      paymentTypeName: "Trip",
      childId: "c1",
      childName: "Alice A",
      amountCents: 20_000,
    },
    {
      categoryId: "cat-butterfly",
      categoryName: "Butterfly",
      paymentTypeId: "pt-fees",
      paymentTypeName: "School Fees",
      childId: "c3",
      childName: "Cara C",
      amountCents: 30_000,
    },
    // Zero-amount row: should never appear or create a phantom entry.
    {
      categoryId: "cat-butterfly",
      categoryName: "Butterfly",
      paymentTypeId: "pt-fees",
      paymentTypeName: "School Fees",
      childId: "c3",
      childName: "Cara C",
      amountCents: 0,
    },
  ];

  it("sorts categories by total outstanding, descending", () => {
    const tree = buildDrilldownTree(rows);
    expect(tree.map((c) => c.name)).toEqual(["Ducks", "Butterfly"]);
    expect(tree[0].amountCents).toBe(170_000); // 100k + 50k + 20k
    expect(tree[1].amountCents).toBe(30_000);
  });

  it("sums correctly across multiple payment types within one category", () => {
    const tree = buildDrilldownTree(rows);
    const ducks = tree[0];
    expect(ducks.paymentTypes.map((p) => p.name)).toEqual(["School Fees", "Trip"]);
    expect(ducks.paymentTypes[0].amountCents).toBe(150_000);
    expect(ducks.paymentTypes[1].amountCents).toBe(20_000);
  });

  it("sorts children within a payment type by amount, descending", () => {
    const tree = buildDrilldownTree(rows);
    const schoolFees = tree[0].paymentTypes[0];
    expect(schoolFees.children.map((c) => c.name)).toEqual(["Alice A", "Bob B"]);
  });

  it("drops zero-amount rows instead of creating a phantom category/child", () => {
    const tree = buildDrilldownTree(rows);
    const butterfly = tree.find((c) => c.name === "Butterfly")!;
    expect(butterfly.paymentTypes[0].amountCents).toBe(30_000);
    expect(butterfly.paymentTypes[0].children).toHaveLength(1);
  });

  it("returns an empty tree for no rows", () => {
    expect(buildDrilldownTree([])).toEqual([]);
  });

  it("never lets a negative-amount row subtract from a total", () => {
    const tree = buildDrilldownTree([
      { ...rows[0], amountCents: -5_000 },
    ]);
    // Negative rows are filtered the same as zero — this function only
    // ever aggregates outstanding/paid amounts, which the callers
    // guarantee are non-negative; this just documents that a bad input
    // can't silently produce a negative-looking total.
    expect(tree).toEqual([]);
  });
});
