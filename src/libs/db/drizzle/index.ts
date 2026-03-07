import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

/**
 * Drizzle ORM 클라이언트 초기화 (Supabase 최신 가이드 준수)
 * postgres-js 드라이버를 사용하여 성능과 서버리스 환경 대응력을 극대화합니다.
 */
const connectionString = process.env.DATABASE_URL!;

// 1. postgres-js 클라이언트 생성 (연결 풀링 지원)
const client = postgres(connectionString, { prepare: false });

// 2. 최신 Drizzle 객체 전달 방식으로 초기화
export const db = drizzle({ client, schema });
