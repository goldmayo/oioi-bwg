import { relations, sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * Album 테이블 정의
 */
export const album = pgTable("Album", {
  id: serial().primaryKey().notNull(),
  name: text().notNull(),
  slug: text().notNull().unique("Album_slug_key"),
  imgUrl: text().notNull(),
  color: text().notNull(),
  releaseDate: timestamp({ precision: 3, mode: "string" }),
  isVisible: boolean().default(true).notNull(),
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
    id: bigserial({ mode: "number" }).primaryKey().notNull(),
    albumId: integer().notNull(),
    title: text(),
    youtubeId: text(),
    lyrics: jsonb(),
    hasOfficialCheer: boolean(),
    isTitle: boolean().default(false).notNull(),
    isVisible: boolean().default(true).notNull(),
    order: bigint({ mode: "number" }),
    createdAt: timestamp({ precision: 3, withTimezone: true, mode: "string" }),
    updatedAt: timestamp({ precision: 3, withTimezone: true, mode: "string" }),
    slug: text(),
  },
  (table) => [
    foreignKey({
      columns: [table.albumId],
      foreignColumns: [album.id],
      name: "Song_albumId_fkey",
    }).onDelete("cascade"),
    index("Song_albumId_idx").on(table.albumId),
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
  "id" | "title" | "slug" | "albumId" | "order" | "updatedAt" | "hasOfficialCheer" | "isTitle" | "isVisible"
>;
