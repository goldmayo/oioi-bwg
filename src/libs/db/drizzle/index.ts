import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { cache } from "react";

import * as schema from "./schema";

/**
 * vinext 공식 권장 방식: import { env } from "cloudflare:workers"
 * RSC, Route Handler, Server Action 어디서든 바로 접근 가능합니다.
 * 참고: https://github.com/cloudflare/vinext#cloudflare-bindings
 */
export const getDb = cache(() => {
  // 프로덕션: env.DB.connectionString (Hyperdrive 프록시 주소)
  // 로컬 dev: CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_DB → Miniflare가 자동 주입
  const connectionString = (env.DB as Hyperdrive)?.connectionString || process.env.DATABASE_URL!;

  const queryClient = postgres(connectionString, {
    prepare: false, // Hyperdrive/PgBouncer 필수 설정
    max: 5, // Cloudflare 공식 권장값
    fetch_types: false, // 불필요한 라운드트립 제거
  });

  return drizzle(queryClient, { schema });
});
