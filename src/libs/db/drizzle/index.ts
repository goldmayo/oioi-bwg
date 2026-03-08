import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

/**
 * Drizzle ORM 클라이언트 초기화 (서버리스 최적화 버전)
 * Supabase Nano 인스턴스의 200 Client 제한을 고려한 설정입니다.
 */
const connectionString = process.env.DATABASE_URL!;

// 1. postgres-js 클라이언트 설정
const client = postgres(connectionString, {
  prepare: false, // Supabase Transaction Mode(6543) 필수 설정
  max: 1, // 워커 인스턴스당 연결 수를 1개로 제한 (커넥션 고갈 방지)
  idle_timeout: 15, // 유휴 연결 반환 시간 (초)
  connect_timeout: 5, // 연결 시도 타임아웃
});

// 2. 최신 Drizzle 객체 전달 방식으로 초기화
export const db = drizzle({ client, schema });
