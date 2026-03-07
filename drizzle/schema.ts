import { sql } from "drizzle-orm"
import { boolean, integer, jsonb, pgTable, serial, text, timestamp,uniqueIndex } from "drizzle-orm/pg-core"



export const song = pgTable("Song", {
	id: serial().primaryKey().notNull(),
	title: text().notNull(),
	albumName: text().notNull(),
	youtubeId: text().notNull(),
	lyrics: jsonb().notNull(),
	hasOfficialCheer: boolean().default(false).notNull(),
	order: integer().default(0).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
	slug: text().notNull(),
}, (table) => [
	uniqueIndex("Song_slug_key").using("btree", table.slug.asc().nullsLast().op("text_ops")),
]);
