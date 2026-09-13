"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="text-sm text-neutral-500 hover:text-neutral-900"
    >
      Log out
    </button>
  );
}
