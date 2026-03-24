import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

/**
 * 표준 Node.js Database Connection (Singleton)
 * Development 환경에서 HMR 시 여러 개의 커넥션이 생성되는 것을 방지합니다.
 */

// 개발 환경에서는 globalThis에 커넥션을 보관
const globalForDb = globalThis as unknown as {
  queryClient: postgres.Sql | undefined;
};

const connectionString = process.env.DATABASE_URL!;

// 이미 생성된 커넥션이 있으면 재사용, 없으면 새로 생성
const queryClient =
  globalForDb.queryClient ??
  postgres(connectionString, {
    prepare: false, // PgBouncer / Supabase Transaction Pooler 필수 설정
    max: 10,
    fetch_types: false, // 불필요한 라운드트립 제거
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.queryClient = queryClient;
}

const db = drizzle(queryClient, { schema });

export const getDb = () => db;
