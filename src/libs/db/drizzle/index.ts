import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

// /**
//  * 전역 싱글톤 객체 (HMR 및 워커 재사용 대응)
//  */
// const globalForDb = globalThis as unknown as {
//   conn: postgres.Sql | undefined;
// };

// export function getDb() {
//   // 1. 이미 연결된 게 있다면 재사용
//   if (globalForDb.conn) return drizzle(globalForDb.conn, { schema });

//   // 2. 환경 변수에서 하이퍼드라이브 혹은 다이렉트 주소 가져오기
//   // Vinext/Wrangler 환경에서는 process.env에 바인딩이 주입됩니다.
//   const connectionString =
//     process.env.DB_CONNECTION_STRING || // 하이퍼드라이브 주소
//     process.env.DATABASE_URL!; // 로컬/백업 주소

//   console.log(`[DB INIT] Connecting to: ${connectionString.split("@")[1]}`); // 보안상 뒷부분만 출력

//   // 3. 하이퍼드라이브용 초경량 클라이언트 설정
//   const queryClient = postgres(connectionString, {
//     prepare: false, // 하이퍼드라이브/서버리스 필수 설정
//     max: 1, // 하이퍼드라이브가 풀링을 해주므로 워커당 1개면 충분
//     idle_timeout: 0, // [핵심] 쿼리 후 즉시 소켓 반환하여 Hung 에러 방지
//     connect_timeout: 5,
//   });

//   globalForDb.conn = queryClient;
//   return drizzle(queryClient, { schema });
// }

// export const db = getDb();
// ... 기존 import 생략

const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined;
};

export function getDb() {
  if (globalForDb.conn) return drizzle(globalForDb.conn, { schema });

  // wrangler.jsonc의 binding "DB"는 process.env.DB_CONNECTION_STRING으로 자동 주입됩니다.
  const connectionString =
    process.env.DB_CONNECTION_STRING || // 하이퍼드라이브가 주는 고속도로 주소
    process.env.DATABASE_URL!; // 로컬 개발용 직접 주소

  const queryClient = postgres(connectionString, {
    prepare: false,
    max: 1,
    idle_timeout: 0, // 여전히 0으로 유지하는 것이 서버리스에선 가장 안전합니다.
    connect_timeout: 10,
  });

  globalForDb.conn = queryClient;
  return drizzle(queryClient, { schema });
}
