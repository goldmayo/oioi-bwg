import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Supabase DB로부터 추출된 Song 테이블 정의
 */
export const song = pgTable(
  "Song",
  {
    id: serial().primaryKey().notNull(),
    title: text().notNull(),
    albumName: text().notNull(),
    youtubeId: text().notNull(),
    lyrics: jsonb().notNull(),
    hasOfficialCheer: boolean().default(false).notNull(),
    order: integer().default(0).notNull(),
    createdAt: timestamp({ precision: 3, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ precision: 3, mode: "string" }).notNull(),
    slug: text().notNull(),
  },
  (table) => [
    uniqueIndex("Song_slug_key").using("btree", table.slug.asc().nullsLast().op("text_ops")),
  ],
);

/**
 * Drizzle 추천 방식의 타입 추론
 */
export type Song = typeof song.$inferSelect; // 조회용 타입
export type InsertSong = typeof song.$inferInsert; // 삽입/수정용 타입

// 가사를 제외한 곡 정보 타입 정의
export type SongListItem = Pick<
  Song,
  "id" | "title" | "slug" | "albumName" | "order" | "updatedAt" | "hasOfficialCheer"
>;
