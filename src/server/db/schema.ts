import { relations, sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  check,
  foreignKey,
  index,
  inet,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const ACCOUNT_ROLES = ["USER", "REVIEWER", "ADMIN"] as const;
export const ACCOUNT_STATUSES = ["PENDING_VERIFICATION", "ACTIVE", "SUSPENDED", "DELETED"] as const;

export type AccountRole = (typeof ACCOUNT_ROLES)[number];
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const EMAIL_VERIFICATION_CHALLENGE_STATUSES = [
  "PENDING",
  "VERIFIED",
  "CONSUMED",
  "INVALIDATED",
] as const;

export type EmailVerificationChallengeStatus =
  (typeof EMAIL_VERIFICATION_CHALLENGE_STATUSES)[number];

export const EMAIL_VERIFICATION_RATE_LIMIT_SCOPES = ["EMAIL", "IP"] as const;
export type EmailVerificationRateLimitScope = (typeof EMAIL_VERIFICATION_RATE_LIMIT_SCOPES)[number];

export const account = pgTable(
  "account",
  {
    id: bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
    role: text().$type<AccountRole>().notNull(),
    status: text().$type<AccountStatus>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [
    check("account_role_check", sql`${table.role} in ('USER', 'REVIEWER', 'ADMIN')`),
    check(
      "account_status_check",
      sql`${table.status} in ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DELETED')`,
    ),
    check(
      "account_deleted_at_check",
      sql`(${table.status} = 'DELETED') = (${table.deletedAt} is not null)`,
    ),
  ],
);

export const profile = pgTable(
  "profile",
  {
    accountId: bigint("account_id", { mode: "bigint" }).primaryKey().notNull(),
    nickname: text().notNull().unique("profile_nickname_key"),
    avatarUrl: text("avatar_url"),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.accountId],
      foreignColumns: [account.id],
      name: "profile_account_id_fkey",
    }).onDelete("restrict"),
  ],
);

export const passwordCredential = pgTable(
  "password_credential",
  {
    accountId: bigint("account_id", { mode: "bigint" }).primaryKey().notNull(),
    email: text().notNull().unique("password_credential_email_key"),
    passwordHash: text("password_hash").notNull(),
    emailVerifiedAt: timestamp("email_verified_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    passwordChangedAt: timestamp("password_changed_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.accountId],
      foreignColumns: [account.id],
      name: "password_credential_account_id_fkey",
    }).onDelete("restrict"),
    check(
      "password_credential_email_check",
      sql`${table.email} <> '' and ${table.email} = lower(btrim(${table.email}))`,
    ),
    check("password_credential_hash_check", sql`${table.passwordHash} <> ''`),
  ],
);

export const emailVerificationChallenge = pgTable(
  "email_verification_challenge",
  {
    id: uuid().defaultRandom().primaryKey(),
    email: text().notNull(),
    otpHash: text("otp_hash").notNull(),
    status: text().$type<EmailVerificationChallengeStatus>().notNull(),
    failedAttempts: integer("failed_attempts").default(0).notNull(),
    ipAddress: inet("ip_address").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
    lastSentAt: timestamp("last_sent_at", { withTimezone: true, mode: "string" }).notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true, mode: "string" }),
    consumedAt: timestamp("consumed_at", { withTimezone: true, mode: "string" }),
    invalidatedAt: timestamp("invalidated_at", { withTimezone: true, mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("email_verification_challenge_email_created_at_idx").on(table.email, table.createdAt),
    index("email_verification_challenge_ip_created_at_idx").on(table.ipAddress, table.createdAt),
    check(
      "email_verification_challenge_status_check",
      sql`${table.status} in ('PENDING', 'VERIFIED', 'CONSUMED', 'INVALIDATED')`,
    ),
    check("email_verification_challenge_otp_hash_check", sql`${table.otpHash} <> ''`),
    check(
      "email_verification_challenge_failed_attempts_check",
      sql`${table.failedAttempts} >= 0 and ${table.failedAttempts} <= 5`,
    ),
    check(
      "email_verification_challenge_verified_at_check",
      sql`(${table.status} = 'VERIFIED') = (${table.verifiedAt} is not null)`,
    ),
    check(
      "email_verification_challenge_consumed_at_check",
      sql`(${table.status} = 'CONSUMED') = (${table.consumedAt} is not null)`,
    ),
    check(
      "email_verification_challenge_invalidated_at_check",
      sql`(${table.status} = 'INVALIDATED') = (${table.invalidatedAt} is not null)`,
    ),
  ],
);

export const emailVerificationRateLimit = pgTable(
  "email_verification_rate_limit",
  {
    scope: text().$type<EmailVerificationRateLimitScope>().notNull(),
    key: text().notNull(),
    windowStartedAt: timestamp("window_started_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    requestCount: integer("request_count").default(0).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.scope, table.key, table.windowStartedAt] }),
    index("email_verification_rate_limit_updated_at_idx").on(table.updatedAt),
    check("email_verification_rate_limit_scope_check", sql`${table.scope} in ('EMAIL', 'IP')`),
    check("email_verification_rate_limit_key_check", sql`${table.key} <> ''`),
    check("email_verification_rate_limit_count_check", sql`${table.requestCount} >= 0`),
  ],
);

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

export const accountRelations = relations(account, ({ one }) => ({
  profile: one(profile),
  passwordCredential: one(passwordCredential),
}));

export const profileRelations = relations(profile, ({ one }) => ({
  account: one(account, {
    fields: [profile.accountId],
    references: [account.id],
  }),
}));

export const passwordCredentialRelations = relations(passwordCredential, ({ one }) => ({
  account: one(account, {
    fields: [passwordCredential.accountId],
    references: [account.id],
  }),
}));

export type AlbumRow = typeof album.$inferSelect;
export type InsertAlbumRow = typeof album.$inferInsert;
export type SongRow = typeof song.$inferSelect;
export type InsertSongRow = typeof song.$inferInsert;
export type AccountRow = typeof account.$inferSelect;
export type InsertAccountRow = typeof account.$inferInsert;
export type ProfileRow = typeof profile.$inferSelect;
export type InsertProfileRow = typeof profile.$inferInsert;
export type PasswordCredentialRow = typeof passwordCredential.$inferSelect;
export type InsertPasswordCredentialRow = typeof passwordCredential.$inferInsert;
export type EmailVerificationChallengeRow = typeof emailVerificationChallenge.$inferSelect;
export type InsertEmailVerificationChallengeRow = typeof emailVerificationChallenge.$inferInsert;
export type EmailVerificationRateLimitRow = typeof emailVerificationRateLimit.$inferSelect;
export type InsertEmailVerificationRateLimitRow = typeof emailVerificationRateLimit.$inferInsert;
