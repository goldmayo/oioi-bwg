import { relations, sql } from "drizzle-orm";
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
 * Album 테이블 정의
 */
export const album = pgTable("Album", {
  id: serial().primaryKey().notNull(),
  name: text().notNull(),
  slug: text().notNull(),
  imgUrl: text().notNull(),
  color: text().notNull(),
  releaseDate: timestamp({ precision: 3, mode: "string" }),
  createdAt: timestamp({ precision: 3, mode: "string" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

/**
 * Supabase DB로부터 추출된 Song 테이블 정의
 */
export const song = pgTable(
  "Song",
  {
    id: serial().primaryKey().notNull(),
    albumId: integer().notNull().references(() => album.id, { onDelete: "cascade" }),
    title: text().notNull(),
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
 * 릴레이션 (Relations) 정의
 */
export const albumRelations = relations(album, ({ many }) => ({
  songs: many(song),
}));

export const songRelations = relations(song, ({ one }) => ({
  album: one(album, {
    fields: [song.albumId],
    references: [album.id],
  }),
}));

/**
 * Drizzle 추천 방식의 타입 추론
 */
export type Album = typeof album.$inferSelect;
export type InsertAlbum = typeof album.$inferInsert;

export type Song = typeof song.$inferSelect;
export type InsertSong = typeof song.$inferInsert;

// 가사를 제외한 곡 정보 타입 정의
export type SongListItem = Pick<
  Song,
  "id" | "title" | "slug" | "albumId" | "order" | "updatedAt" | "hasOfficialCheer"
>;
