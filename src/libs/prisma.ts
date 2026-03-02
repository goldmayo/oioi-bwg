import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { PrismaClient } from "../app/generated/prisma/client";

const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Prisma 7 & Next.js 16 Singleton 패턴
 * v7 (Rust-free) 클라이언트는 드라이버 어댑터를 필수적으로 사용합니다.
 * Supabase 커넥션 풀링(DATABASE_URL)을 Pool을 통해 주입합니다.
 */
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
