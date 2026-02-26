import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Prisma CLI는 시딩 및 마이그레이션 시 이 url(직접 연결)을 사용합니다.
    url: env("DIRECT_URL"),
  },
});
