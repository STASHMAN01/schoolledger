import { PrismaClient } from "@prisma/client";

// Standard Next.js-safe Prisma singleton: avoids exhausting Postgres
// connections from hot-reload creating a new client on every file save
// in dev, and is the ONLY place a PrismaClient should be constructed.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
