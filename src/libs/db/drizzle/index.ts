import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

/**
 * Drizzle ORM 클라이언트 초기화
 * postgres-js 드라이버를 사용하여 성능과 서버리스 환경 대응력을 극대화합니다.
 */
const connectionString = process.env.DATABASE_URL!;

// 1. postgres-js 클라이언트 생성 (연결 풀링 지원)
// 서버리스 환경 충돌 방지를 위해 기본 설정(prepare: false)만 유지합니다.
const client = postgres(connectionString, {
  prepare: false,
  max: 1, // 프로덕션 안정성을 위해 1 유지
  idle_timeout: 5, // 10초도 길 수 있습니다. '0'으로 설정해 즉시 반환하세요.
  connect_timeout: 5,
});

// 2. 최신 Drizzle 객체 전달 방식으로 초기화
export const db = drizzle({ client, schema });
