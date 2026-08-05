import "server-only";
import { PrismaClient } from "@prisma/client";

/**
 * Single Prisma client, reused across hot reloads in dev so we don't exhaust
 * the connection pool. Standard Next.js + Prisma pattern.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
