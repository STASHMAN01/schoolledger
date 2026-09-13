"use client";

import { createContext, useContext } from "react";
import type { Role } from "@prisma/client";

type OrgContextValue = {
  organizationId: string;
  organizationName: string;
  role: Role;
  hasActiveAccess: boolean;
  subscriptionStatus: string;
  trialEndsAt: string | null;
};

const OrgContext = createContext<OrgContextValue | null>(null);

export function OrgProvider({
  value,
  children,
}: {
  value: OrgContextValue;
  children: React.ReactNode;
}) {
  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrg must be used within OrgProvider");
  return ctx;
}

// A user with this role can create/edit/archive categories & children.
// Kept in one place so the rule matches the server-side check in every
// API route under /api/organizations/[organizationId]/... exactly.
export function canManage(role: Role) {
  return role === "ADMIN" || role === "ACCOUNTANT" || role === "MANAGER";
}
