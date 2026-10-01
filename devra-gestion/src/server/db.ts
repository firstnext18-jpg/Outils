import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Client Prisma unique pour tout le processus. En développement, le rechargement
 * à chaud recrée les modules : on garde l'instance sur `globalThis` pour ne pas
 * ouvrir un nouveau pool de connexions à chaque modification.
 */
function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

/** Client utilisable dans une transaction interactive (`db.$transaction(async (tx) => …)`). */
export type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];
