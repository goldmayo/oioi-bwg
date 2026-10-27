import type { WaveformData } from "@oioi-bwg/contracts/waveform";
import { v7 } from "uuid";

import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  foreignKey,
  index,
  inet,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  type PgTableExtraConfigValue,
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
    id: uuid().primaryKey().$defaultFn(v7),
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
    accountId: uuid("account_id").primaryKey().notNull(),
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
    accountId: uuid("account_id").primaryKey().notNull(),
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

export const adminMfa = pgTable(
  "admin_mfa",
  {
    accountId: uuid("account_id").primaryKey().notNull(),
    encryptedSecret: text("encrypted_secret"),
    enabledAt: timestamp("enabled_at", { withTimezone: true, mode: "string" }),
    lastUsedStep: integer("last_used_step"),
    version: integer().default(1).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.accountId],
      foreignColumns: [account.id],
      name: "admin_mfa_account_id_fkey",
    }).onDelete("restrict"),
    check("admin_mfa_version_check", sql`${table.version} > 0`),
    check(
      "admin_mfa_secret_check",
      sql`${table.encryptedSecret} is null or ${table.encryptedSecret} <> ''`,
    ),
    check("admin_mfa_step_check", sql`${table.lastUsedStep} is null or ${table.lastUsedStep} >= 0`),
    check(
      "admin_mfa_state_check",
      sql`(${table.enabledAt} is null and ${table.lastUsedStep} is null)
        or (${table.enabledAt} is not null and ${table.encryptedSecret} is not null and ${table.lastUsedStep} is not null)`,
    ),
  ],
);

export const notification = pgTable(
  "notification",
  {
    id: uuid().primaryKey().$defaultFn(v7),
    recipientAccountId: uuid("recipient_account_id")
      .notNull()
      .references(() => account.id, { onDelete: "restrict" }),
    type: text().$type<"WAVEFORM_SUCCEEDED" | "WAVEFORM_FAILED">().notNull(),
    resourceType: text("resource_type").$type<"WAVEFORM_JOB">().notNull(),
    resourceId: uuid("resource_id").notNull(),
    eventKey: text("event_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    readAt: timestamp("read_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [
    unique("notification_event_key").on(table.recipientAccountId, table.type, table.eventKey),
    index("notification_recipient_cursor_idx").on(
      table.recipientAccountId,
      table.createdAt.desc(),
      table.id.desc(),
    ),
    index("notification_unread_idx")
      .on(table.recipientAccountId)
      .where(sql`${table.readAt} is null`),
    check(
      "notification_type_check",
      sql`${table.type} in ('WAVEFORM_SUCCEEDED', 'WAVEFORM_FAILED')`,
    ),
    check("notification_resource_type_check", sql`${table.resourceType} = 'WAVEFORM_JOB'`),
    check("notification_event_key_check", sql`length(${table.eventKey}) between 1 and 256`),
  ],
);

export const pushInstallation = pgTable(
  "push_installation",
  {
    id: uuid().primaryKey().$defaultFn(v7),
    fid: text().notNull().unique("push_installation_fid_key"),
    accountId: uuid("account_id")
      .notNull()
      .references(() => account.id, { onDelete: "restrict" }),
    mfaVersion: integer("mfa_version").notNull(),
    bindingVersion: integer("binding_version").default(1).notNull(),
    enabled: boolean().default(true).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
  },
  (table) => [
    index("push_installation_account_idx")
      .on(table.accountId)
      .where(sql`${table.enabled}`),
    check(
      "push_installation_version_check",
      sql`${table.mfaVersion} > 0 and ${table.bindingVersion} > 0`,
    ),
    check("push_installation_fid_check", sql`length(${table.fid}) between 16 and 256`),
  ],
);

export const notificationDelivery = pgTable(
  "notification_delivery",
  {
    id: uuid().primaryKey().$defaultFn(v7),
    notificationId: uuid("notification_id")
      .notNull()
      .references(() => notification.id, { onDelete: "restrict" }),
    installationId: uuid("installation_id")
      .notNull()
      .references(() => pushInstallation.id, { onDelete: "restrict" }),
    bindingVersion: integer("binding_version").notNull(),
    status: text().$type<"PENDING" | "ACCEPTED" | "DISCARDED">().default("PENDING").notNull(),
    attemptCount: integer("attempt_count").default(0).notNull(),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
    leaseToken: uuid("lease_token"),
    leaseUntil: timestamp("lease_until", { withTimezone: true, mode: "string" }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true, mode: "string" }),
    lastErrorCode: text("last_error_code"),
  },
  (table) => [
    unique("notification_delivery_target_key").on(
      table.notificationId,
      table.installationId,
      table.bindingVersion,
    ),
    index("notification_delivery_due_idx")
      .on(table.nextAttemptAt, table.leaseUntil)
      .where(sql`${table.status} = 'PENDING'`),
    check(
      "notification_delivery_status_check",
      sql`${table.status} in ('PENDING', 'ACCEPTED', 'DISCARDED')`,
    ),
    check(
      "notification_delivery_attempt_check",
      sql`${table.attemptCount} >= 0 and ${table.bindingVersion} > 0`,
    ),
    check(
      "notification_delivery_lease_check",
      sql`(${table.leaseToken} is null) = (${table.leaseUntil} is null)`,
    ),
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

export const album = pgTable("album", {
  id: uuid().primaryKey().notNull().$defaultFn(v7),
  name: text().notNull(),
  slug: text().notNull().unique("album_slug_key"),
  imgUrl: text("image_url").notNull(),
  color: text().notNull(),
  releaseDate: timestamp("release_date", { precision: 3, mode: "string" }),
  isVisible: boolean("is_visible").default(true).notNull(),
  createdAt: timestamp("created_at", { precision: 3, mode: "string" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const song = pgTable(
  "song",
  {
    id: uuid().primaryKey().notNull().$defaultFn(v7),
    albumId: uuid("album_id").notNull(),
    title: text(),
    youtubeId: text("youtube_id"),
    lyrics: jsonb(),
    hasOfficialCheer: boolean("has_official_cheer"),
    isTitle: boolean("is_title").default(false).notNull(),
    isVisible: boolean("is_visible").default(true).notNull(),
    order: bigint("sort_order", { mode: "number" }),
    createdAt: timestamp("created_at", { precision: 3, withTimezone: true, mode: "string" }),
    updatedAt: timestamp("updated_at", { precision: 3, withTimezone: true, mode: "string" }),
    slug: text().unique("song_slug_key"),
  },
  (table) => [
    foreignKey({
      columns: [table.albumId],
      foreignColumns: [album.id],
      name: "song_album_id_fkey",
    }).onDelete("cascade"),
    index("song_album_id_idx").on(table.albumId),
  ],
);

export const cheerGuide = pgTable(
  "cheer_guide",
  {
    id: uuid().primaryKey().$defaultFn(v7),
    songId: uuid("song_id").notNull(),
    mode: text().$type<"CONCERT" | "FESTIVAL">().notNull(),
    legacyWriteTarget: boolean("legacy_write_target").default(false).notNull(),
    currentPublicationId: uuid("current_publication_id"),
    lockVersion: integer("lock_version").default(1).notNull(),
    createdAt: timestamp("created_at", { precision: 3, withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { precision: 3, withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  // The explicit return type breaks the guide → publication → snapshot → guide type cycle.
  (table): PgTableExtraConfigValue[] => [
    foreignKey({
      columns: [table.songId],
      foreignColumns: [song.id],
      name: "cheer_guide_song_id_fkey",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.id, table.currentPublicationId],
      foreignColumns: [cheerGuidePublication.cheerGuideId, cheerGuidePublication.id],
      name: "cheer_guide_id_current_publication_id_fkey",
    }).onDelete("restrict"),
    unique("cheer_guide_song_id_mode_key").on(table.songId, table.mode),
    uniqueIndex("cheer_guide_song_id_legacy_write_target_key")
      .on(table.songId)
      .where(sql`${table.legacyWriteTarget}`),
    check("cheer_guide_mode_check", sql`${table.mode} in ('CONCERT', 'FESTIVAL')`),
    check("cheer_guide_lock_version_check", sql`${table.lockVersion} > 0`),
  ],
);

export const cheerGuideSnapshot = pgTable(
  "cheer_guide_snapshot",
  {
    id: uuid().primaryKey().$defaultFn(v7),
    cheerGuideId: uuid("cheer_guide_id").notNull(),
    versionNo: integer("version_no").notNull(),
    lyrics: jsonb().notNull(),
    referenceYoutubeId: text("reference_youtube_id").notNull(),
    sourceType: text("source_type").$type<"OFFICIAL" | "FANDOM">().notNull(),
    sourceUrl: text("source_url"),
    guideVideoUrl: text("guide_video_url"),
    description: text(),
    createdByAccountId: uuid("created_by_account_id"),
    changeSummary: text("change_summary").notNull(),
    createdAt: timestamp("created_at", { precision: 3, withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.cheerGuideId],
      foreignColumns: [cheerGuide.id],
      name: "cheer_guide_snapshot_cheer_guide_id_fkey",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.createdByAccountId],
      foreignColumns: [account.id],
      name: "cheer_guide_snapshot_created_by_account_id_fkey",
    }).onDelete("restrict"),
    unique("cheer_guide_snapshot_cheer_guide_id_version_no_key").on(
      table.cheerGuideId,
      table.versionNo,
    ),
    unique("cheer_guide_snapshot_cheer_guide_id_id_key").on(table.cheerGuideId, table.id),
    index("cheer_guide_snapshot_created_by_account_id_idx").on(table.createdByAccountId),
    check("cheer_guide_snapshot_version_no_check", sql`${table.versionNo} > 0`),
    check("cheer_guide_snapshot_lyrics_check", sql`jsonb_typeof(${table.lyrics}) = 'array'`),
    check(
      "cheer_guide_snapshot_reference_youtube_id_check",
      sql`length(btrim(${table.referenceYoutubeId})) > 0`,
    ),
    check(
      "cheer_guide_snapshot_source_type_check",
      sql`${table.sourceType} in ('OFFICIAL', 'FANDOM')`,
    ),
    check(
      "cheer_guide_snapshot_source_url_check",
      sql`${table.sourceType} <> 'OFFICIAL' or (${table.sourceUrl} is not null and length(btrim(${table.sourceUrl})) > 0)`,
    ),
    check(
      "cheer_guide_snapshot_change_summary_check",
      sql`length(btrim(${table.changeSummary})) > 0`,
    ),
  ],
);

export const cheerGuidePublication = pgTable(
  "cheer_guide_publication",
  {
    id: uuid().primaryKey().$defaultFn(v7),
    cheerGuideId: uuid("cheer_guide_id").notNull(),
    publicationNo: integer("publication_no").notNull(),
    action: text().$type<"PUBLISH" | "UNPUBLISH">().notNull(),
    snapshotId: uuid("snapshot_id").notNull(),
    actorAccountId: uuid("actor_account_id").notNull(),
    reason: text().notNull(),
    createdAt: timestamp("created_at", { precision: 3, withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.cheerGuideId],
      foreignColumns: [cheerGuide.id],
      name: "cheer_guide_publication_cheer_guide_id_fkey",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.cheerGuideId, table.snapshotId],
      foreignColumns: [cheerGuideSnapshot.cheerGuideId, cheerGuideSnapshot.id],
      name: "cheer_guide_publication_cheer_guide_id_snapshot_id_fkey",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.actorAccountId],
      foreignColumns: [account.id],
      name: "cheer_guide_publication_actor_account_id_fkey",
    }).onDelete("restrict"),
    unique("cheer_guide_publication_cheer_guide_id_publication_no_key").on(
      table.cheerGuideId,
      table.publicationNo,
    ),
    unique("cheer_guide_publication_cheer_guide_id_id_key").on(table.cheerGuideId, table.id),
    index("cheer_guide_publication_cheer_guide_id_snapshot_id_idx").on(
      table.cheerGuideId,
      table.snapshotId,
    ),
    index("cheer_guide_publication_actor_account_id_idx").on(table.actorAccountId),
    check("cheer_guide_publication_publication_no_check", sql`${table.publicationNo} > 0`),
    check("cheer_guide_publication_action_check", sql`${table.action} in ('PUBLISH', 'UNPUBLISH')`),
    check("cheer_guide_publication_reason_check", sql`length(btrim(${table.reason})) > 0`),
  ],
);

export const albumRelations = relations(album, ({ many }) => ({
  songs: many(song),
}));

export const songRelations = relations(song, ({ one, many }) => ({
  cheerGuides: many(cheerGuide),
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

export const cheerGuideRelations = relations(cheerGuide, ({ one, many }) => ({
  song: one(song, { fields: [cheerGuide.songId], references: [song.id] }),
  currentPublication: one(cheerGuidePublication, {
    fields: [cheerGuide.id, cheerGuide.currentPublicationId],
    references: [cheerGuidePublication.cheerGuideId, cheerGuidePublication.id],
    relationName: "currentGuidePublication",
  }),
  publications: many(cheerGuidePublication, { relationName: "guidePublications" }),
}));
export const cheerGuidePublicationRelations = relations(cheerGuidePublication, ({ one }) => ({
  guide: one(cheerGuide, {
    fields: [cheerGuidePublication.cheerGuideId],
    references: [cheerGuide.id],
    relationName: "guidePublications",
  }),
  snapshot: one(cheerGuideSnapshot, {
    fields: [cheerGuidePublication.cheerGuideId, cheerGuidePublication.snapshotId],
    references: [cheerGuideSnapshot.cheerGuideId, cheerGuideSnapshot.id],
  }),
}));

/** 공지·업데이트 게시 내용. 현재 공개 조회 전환만 제공한다. */
export const servicePublication = pgTable(
  "service_publication",
  {
    id: uuid().primaryKey().$defaultFn(v7),
    kind: text().$type<"notice" | "update">().notNull(),
    title: text().notNull(),
    publishedOn: date("published_on", { mode: "string" }).notNull(),
    isPublished: boolean("is_published").notNull().default(false),
    category: text(),
    releaseVersion: text("release_version"),
    content: jsonb().$type<string | string[]>().notNull(),
    lockVersion: integer("lock_version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("service_publication_title_check", sql`length(btrim(${t.title})) between 1 and 200`),
    check("service_publication_lock_version_check", sql`${t.lockVersion} > 0`),
    check(
      "service_publication_shape_check",
      sql`case
      when ${t.kind} = 'notice' then
        ${t.category} is not null and length(btrim(${t.category})) between 1 and 40
        and ${t.releaseVersion} is null and jsonb_typeof(${t.content}) = 'string'
        and length(btrim(${t.content} #>> '{}')) between 1 and 20000
      when ${t.kind} = 'update' then
        ${t.category} is null and ${t.releaseVersion} is not null
        and length(btrim(${t.releaseVersion})) between 1 and 40
        and case when jsonb_typeof(${t.content}) = 'array' then
          jsonb_array_length(${t.content}) between 1 and 100
          and not jsonb_path_exists(${t.content}, 'strict $[*] ? (@.type() != "string")')
        else false end
      else false end`,
    ),
    uniqueIndex("service_publication_release_version_key")
      .on(t.releaseVersion)
      .where(sql`${t.kind} = 'update'`),
    index("service_publication_list_idx").on(t.kind, t.isPublished, t.publishedOn, t.id),
  ],
);

/** 안내·약관 문서의 버전. 공개된 가장 높은 버전이 현재 본문이다. */
export const servicePolicy = pgTable(
  "service_policy",
  {
    id: uuid().primaryKey().$defaultFn(v7),
    slug: text().notNull(),
    version: integer().notNull(),
    title: text().notNull(),
    description: text().notNull(),
    effectiveOn: date("effective_on", { mode: "string" }).notNull(),
    content: jsonb().$type<string[]>().notNull(),
    changeNotice: text("change_notice"),
    isPublished: boolean("is_published").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "service_policy_slug_check",
      sql`${t.slug} in ('privacy', 'terms', 'copyright', 'email', 'ga')`,
    ),
    check("service_policy_version_check", sql`${t.version} > 0`),
    check("service_policy_title_check", sql`length(btrim(${t.title})) between 1 and 200`),
    check(
      "service_policy_description_check",
      sql`length(btrim(${t.description})) between 1 and 500`,
    ),
    check(
      "service_policy_content_check",
      sql`case when jsonb_typeof(${t.content}) = 'array' then
      jsonb_array_length(${t.content}) between 1 and 100
      and not jsonb_path_exists(${t.content}, 'strict $[*] ? (@.type() != "string")')
      else false end`,
    ),
    check(
      "service_policy_change_notice_check",
      sql`${t.changeNotice} is null or length(btrim(${t.changeNotice})) between 1 and 2000`,
    ),
    unique("service_policy_slug_version_key").on(t.slug, t.version),
    index("service_policy_public_idx")
      .on(t.slug, t.version.desc())
      .where(sql`${t.isPublished} = true`),
  ],
);

/** 파형 분석의 작업 상태. 생성 transport와 Runner 활성화는 별도 P08 관문이다. */
export const waveformJob = pgTable(
  "waveform_job",
  {
    id: uuid().primaryKey().$defaultFn(v7),
    songId: uuid("song_id")
      .notNull()
      .references(() => song.id, { onDelete: "cascade" }),
    videoId: text("video_id").notNull(),
    status: text()
      .$type<"QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED">()
      .notNull()
      .default("QUEUED"),
    attemptId: uuid("attempt_id"),
    errorCode: text("error_code").$type<
      "ENQUEUE_FAILED" | "PROCESSING_FAILED" | "DLQ" | "DELIVERY_EXPIRED" | "SOURCE_CHANGED"
    >(),
    enqueuedAt: timestamp("enqueued_at", { withTimezone: true, mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "string" }),
    finishedAt: timestamp("finished_at", { withTimezone: true, mode: "string" }),
  },
  (t) => [
    uniqueIndex("waveform_job_active_key")
      .on(t.songId, t.videoId)
      .where(sql`${t.status} in ('QUEUED','RUNNING')`),
    index("waveform_job_song_idx").on(t.songId),
    check("waveform_job_video_check", sql`${t.videoId} ~ '^[A-Za-z0-9_-]{11}$'`),
    check(
      "waveform_job_status_check",
      sql`${t.status} in ('QUEUED','RUNNING','SUCCEEDED','FAILED')`,
    ),
    check(
      "waveform_job_terminal_check",
      sql`(${t.status} in ('SUCCEEDED','FAILED')) = (${t.finishedAt} is not null)`,
    ),
    check(
      "waveform_job_attempt_check",
      sql`${t.status} not in ('RUNNING','SUCCEEDED') or (${t.attemptId} is not null and ${t.startedAt} is not null)`,
    ),
    check(
      "waveform_job_error_check",
      sql`case when ${t.status} = 'FAILED' then ${t.errorCode} is not null and ${t.errorCode} in ('ENQUEUE_FAILED','PROCESSING_FAILED','DLQ','DELIVERY_EXPIRED','SOURCE_CHANGED') else ${t.errorCode} is null end`,
    ),
  ],
);
export const waveformJobRequester = pgTable(
  "waveform_job_requester",
  {
    jobId: uuid("job_id")
      .notNull()
      .references(() => waveformJob.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => account.id, { onDelete: "restrict" }),
  },
  (t) => [
    primaryKey({ columns: [t.jobId, t.accountId] }),
    index("waveform_job_requester_account_idx").on(t.accountId),
  ],
);
export const waveform = pgTable(
  "waveform",
  {
    id: uuid().primaryKey().$defaultFn(v7),
    songId: uuid("song_id")
      .notNull()
      .unique()
      .references(() => song.id, { onDelete: "cascade" }),
    videoId: text("video_id").notNull(),
    data: jsonb().$type<WaveformData>().notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("waveform_video_check", sql`${t.videoId} ~ '^[A-Za-z0-9_-]{11}$'`),
    check("waveform_data_check", sql`jsonb_typeof(${t.data}) = 'object'`),
  ],
);
