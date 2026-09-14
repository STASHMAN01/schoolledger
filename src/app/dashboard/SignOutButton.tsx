"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="transition-standard rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-background hover:text-foreground"
    >
      Log out
    </button>
  );
}
