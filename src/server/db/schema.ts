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

export const albumRelations = relations(album, ({ many }) => ({
  songs: many(song),
}));

export const songRelations = relations(song, ({ one }) => ({
  album: one(album, {
    fields: [song.albumId],
    references: [album.id],
  }),
}));

export type AlbumRow = typeof album.$inferSelect;
export type InsertAlbumRow = typeof album.$inferInsert;
export type SongRow = typeof song.$inferSelect;
export type InsertSongRow = typeof song.$inferInsert;
