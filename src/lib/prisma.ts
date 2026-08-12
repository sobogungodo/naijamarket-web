import { PrismaClient } from "@prisma/client";
import { wrapPrismaForSupabase } from "./supabase-prisma-proxy";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const realPrisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = realPrisma;

// Backend-aware: raw methods route to Supabase pg when DB_BACKEND=supabase (see
// supabase-prisma-proxy). Production returns the real client unchanged.
export const prisma = wrapPrismaForSupabase(realPrisma);
