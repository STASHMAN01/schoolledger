import { PrismaClient } from "@prisma/client";
import { encryptionExtension } from "@/lib/encryptedFields";

// Standard Next.js-safe Prisma singleton: avoids exhausting Postgres
// connections from hot-reload creating a new client on every file save
// in dev, and is the ONLY place a PrismaClient should be constructed.
//
// Wrapped with encryptionExtension (security review #15/#21): ID numbers,
// ID documents, form answers, allergies and the medicine register are
// encrypted on write and decrypted on read, transparently. Use this `db`
// (never a bare PrismaClient) so that always happens.
function createClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  }).$extends(encryptionExtension);
}

type Db = ReturnType<typeof createClient>;

const globalForPrisma = globalThis as unknown as {
  prisma: Db | undefined;
};

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

/**
 * The client inside db.$transaction(async (tx) => ...). Use this instead of
 * Prisma.TransactionClient, which doesn't know about the encryption
 * extension above.
 */
export type Tx = Parameters<Parameters<Db["$transaction"]>[0]>[0];
