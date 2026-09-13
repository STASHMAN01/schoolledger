import { NextResponse } from "next/server";
import { TenantAccessError } from "@/lib/tenant";
import { ZodError } from "zod";

/**
 * Central error → HTTP response mapping so every route handles auth,
 * validation, and unexpected errors the same way — no route should ever
 * leak a raw error message/stack trace to the client.
 */
export function handleApiError(err: unknown) {
  if (err instanceof TenantAccessError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: "Invalid input.", issues: err.flatten() },
      { status: 400 }
    );
  }
  console.error(err);
  return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
}
