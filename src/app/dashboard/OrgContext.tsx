"use client";

import { createContext, useContext } from "react";
import type { Permission, Role } from "@prisma/client";

type OrgContextValue = {
  organizationId: string;
  organizationName: string;
  role: Role;
  // The caller's actual effective permissions (role default + any
  // per-person overrides an admin has set — see src/lib/permissions.ts).
  // UI should check THIS, never the role directly, so a permission
  // override actually changes what someone sees without a code change.
  permissions: Permission[];
  hasActiveAccess: boolean;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  currencyCode: string;
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

export function useHasPermission(permission: Permission) {
  const { permissions } = useOrg();
  return permissions.includes(permission);
}
