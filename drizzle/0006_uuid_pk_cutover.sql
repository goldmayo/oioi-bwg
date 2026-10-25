-- Offline UUIDv7 map is passed as a transaction-local setting by the guarded migrator.
-- Empty databases need no map; populated databases fail closed without exact coverage.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
LOCK TABLE public."Album", public."Song", public.account, public.profile,
  public.password_credential, public.admin_mfa IN ACCESS EXCLUSIVE MODE;
--> statement-breakpoint
CREATE TEMP TABLE uuid_cutover_map (
  entity text NOT NULL CHECK (entity IN ('album', 'song', 'account')),
  old_id bigint NOT NULL CHECK (old_id > 0),
  new_id uuid NOT NULL UNIQUE CHECK (substring(new_id::text, 15, 1) = '7' AND substring(new_id::text, 20, 1) IN ('8', '9', 'a', 'b')),
  album_id uuid,
  role text,
  status text,
  mfa_version integer,
  PRIMARY KEY (entity, old_id)
) ON COMMIT DROP;
--> statement-breakpoint
CREATE TEMP TABLE uuid_cutover_admin_reset (old_id bigint PRIMARY KEY) ON COMMIT DROP;
--> statement-breakpoint
DO $$
DECLARE
  document jsonb := coalesce(nullif(current_setting('oioi.uuid_cutover_map', true), ''), '{"formatVersion":2,"albums":[],"songs":[],"accounts":[],"resetAdminOldIds":[]}')::jsonb;
BEGIN
  IF document->>'formatVersion' IS DISTINCT FROM '2' THEN
    RAISE EXCEPTION 'UUID_CUTOVER_MAP_VERSION_REJECTED';
  END IF;
  INSERT INTO pg_temp.uuid_cutover_map (entity, old_id, new_id)
    SELECT 'album', x."oldId"::bigint, x.id FROM jsonb_to_recordset(document->'albums') AS x("oldId" text, id uuid);
  INSERT INTO pg_temp.uuid_cutover_map (entity, old_id, new_id, album_id)
    SELECT 'song', x."oldId"::bigint, x.id, x."albumId" FROM jsonb_to_recordset(document->'songs') AS x("oldId" text, id uuid, "albumId" uuid);
  INSERT INTO pg_temp.uuid_cutover_map (entity, old_id, new_id, role, status, mfa_version)
    SELECT 'account', x."oldId"::bigint, x.id, x.role, x.status, x."mfaVersion"
    FROM jsonb_to_recordset(document->'accounts') AS x("oldId" text, id uuid, role text, status text, "mfaVersion" integer);
  INSERT INTO pg_temp.uuid_cutover_admin_reset SELECT value::bigint FROM jsonb_array_elements_text(document->'resetAdminOldIds');

  IF EXISTS (
    (SELECT entity, old_id FROM pg_temp.uuid_cutover_map EXCEPT
      (SELECT 'album', id::bigint FROM public."Album" UNION ALL SELECT 'song', id FROM public."Song" UNION ALL SELECT 'account', id FROM public.account))
    UNION ALL
    ((SELECT 'album', id::bigint FROM public."Album" UNION ALL SELECT 'song', id FROM public."Song" UNION ALL SELECT 'account', id FROM public.account)
      EXCEPT SELECT entity, old_id FROM pg_temp.uuid_cutover_map)
  ) THEN RAISE EXCEPTION 'UUID_CUTOVER_MAP_COVERAGE_REJECTED'; END IF;

  IF EXISTS (
    SELECT 1 FROM public."Song" s
    JOIN pg_temp.uuid_cutover_map sm ON sm.entity = 'song' AND sm.old_id = s.id
    JOIN pg_temp.uuid_cutover_map am ON am.entity = 'album' AND am.old_id = s."albumId"
    WHERE sm.album_id IS DISTINCT FROM am.new_id
  ) THEN RAISE EXCEPTION 'UUID_CUTOVER_MAP_PARENT_REJECTED'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.account a JOIN pg_temp.uuid_cutover_map m ON m.entity = 'account' AND m.old_id = a.id
    LEFT JOIN public.admin_mfa f ON f.account_id = a.id
    WHERE m.role IS DISTINCT FROM a.role OR m.status IS DISTINCT FROM a.status OR m.mfa_version IS DISTINCT FROM f.version
  ) THEN RAISE EXCEPTION 'UUID_CUTOVER_ACCOUNT_CHANGED'; END IF;

  IF EXISTS (
    SELECT 1 FROM pg_temp.uuid_cutover_admin_reset r LEFT JOIN public.account a ON a.id = r.old_id
    WHERE a.id IS NULL OR a.role <> 'ADMIN' OR a.status <> 'ACTIVE'
  ) OR EXISTS (
    SELECT 1 FROM public.admin_mfa f LEFT JOIN pg_temp.uuid_cutover_admin_reset r ON r.old_id = f.account_id WHERE r.old_id IS NULL
  ) THEN RAISE EXCEPTION 'UUID_CUTOVER_ADMIN_RESET_REQUIRED'; END IF;
END $$;
--> statement-breakpoint
CREATE FUNCTION pg_temp.uuid_cutover_id(kind text, legacy bigint) RETURNS uuid
LANGUAGE sql STABLE AS $$ SELECT new_id FROM pg_temp.uuid_cutover_map WHERE entity = kind AND old_id = legacy $$;
--> statement-breakpoint
CREATE TEMP TABLE uuid_cutover_album_payload ON COMMIT DROP AS
  SELECT pg_temp.uuid_cutover_id('album', id) AS id, to_jsonb(a) - 'id' AS payload FROM public."Album" a;
--> statement-breakpoint
CREATE TEMP TABLE uuid_cutover_song_payload ON COMMIT DROP AS
  SELECT pg_temp.uuid_cutover_id('song', id) AS id, pg_temp.uuid_cutover_id('album', "albumId") AS album_id,
    to_jsonb(s) - 'id' - 'albumId' AS payload FROM public."Song" s;
--> statement-breakpoint
-- Only explicitly selected administrators lose old credential/MFA material. Profile/account survive.
DELETE FROM public.password_credential c USING pg_temp.uuid_cutover_admin_reset r WHERE c.account_id = r.old_id;
--> statement-breakpoint
UPDATE public.admin_mfa f SET encrypted_secret = NULL, enabled_at = NULL, last_used_step = NULL, version = version + 1
FROM pg_temp.uuid_cutover_admin_reset r WHERE f.account_id = r.old_id;
--> statement-breakpoint
ALTER TABLE public."Song" DROP CONSTRAINT "Song_albumId_fkey";
--> statement-breakpoint
ALTER TABLE public.profile DROP CONSTRAINT profile_account_id_fkey;
--> statement-breakpoint
ALTER TABLE public.password_credential DROP CONSTRAINT password_credential_account_id_fkey;
--> statement-breakpoint
ALTER TABLE public.admin_mfa DROP CONSTRAINT admin_mfa_account_id_fkey;
--> statement-breakpoint
ALTER TABLE public.account ALTER COLUMN id DROP IDENTITY;
--> statement-breakpoint
ALTER TABLE public."Album" ALTER COLUMN id DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE public."Song" ALTER COLUMN id DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE public."Album" ALTER COLUMN id TYPE uuid USING pg_temp.uuid_cutover_id('album', id);
--> statement-breakpoint
ALTER TABLE public."Song" ALTER COLUMN id TYPE uuid USING pg_temp.uuid_cutover_id('song', id),
  ALTER COLUMN "albumId" TYPE uuid USING pg_temp.uuid_cutover_id('album', "albumId");
--> statement-breakpoint
ALTER TABLE public.account ALTER COLUMN id TYPE uuid USING pg_temp.uuid_cutover_id('account', id);
--> statement-breakpoint
ALTER TABLE public.profile ALTER COLUMN account_id TYPE uuid USING pg_temp.uuid_cutover_id('account', account_id);
--> statement-breakpoint
ALTER TABLE public.password_credential ALTER COLUMN account_id TYPE uuid USING pg_temp.uuid_cutover_id('account', account_id);
--> statement-breakpoint
ALTER TABLE public.admin_mfa ALTER COLUMN account_id TYPE uuid USING pg_temp.uuid_cutover_id('account', account_id);
--> statement-breakpoint
ALTER TABLE public."Album" RENAME TO album;
--> statement-breakpoint
ALTER TABLE public."Song" RENAME TO song;
--> statement-breakpoint
ALTER TABLE public.album RENAME COLUMN "imgUrl" TO image_url;
--> statement-breakpoint
ALTER TABLE public.album RENAME COLUMN "releaseDate" TO release_date;
--> statement-breakpoint
ALTER TABLE public.album RENAME COLUMN "isVisible" TO is_visible;
--> statement-breakpoint
ALTER TABLE public.album RENAME COLUMN "createdAt" TO created_at;
--> statement-breakpoint
ALTER TABLE public.song RENAME COLUMN "albumId" TO album_id;
--> statement-breakpoint
ALTER TABLE public.song RENAME COLUMN "youtubeId" TO youtube_id;
--> statement-breakpoint
ALTER TABLE public.song RENAME COLUMN "hasOfficialCheer" TO has_official_cheer;
--> statement-breakpoint
ALTER TABLE public.song RENAME COLUMN "isTitle" TO is_title;
--> statement-breakpoint
ALTER TABLE public.song RENAME COLUMN "isVisible" TO is_visible;
--> statement-breakpoint
ALTER TABLE public.song RENAME COLUMN "order" TO sort_order;
--> statement-breakpoint
ALTER TABLE public.song RENAME COLUMN "createdAt" TO created_at;
--> statement-breakpoint
ALTER TABLE public.song RENAME COLUMN "updatedAt" TO updated_at;
--> statement-breakpoint
ALTER TABLE public.album RENAME CONSTRAINT "Album_pkey" TO album_pkey;
--> statement-breakpoint
ALTER TABLE public.album RENAME CONSTRAINT "Album_slug_key" TO album_slug_key;
--> statement-breakpoint
ALTER TABLE public.song RENAME CONSTRAINT "Song_pkey" TO song_pkey;
--> statement-breakpoint
ALTER TABLE public.song RENAME CONSTRAINT "Song_slug_key" TO song_slug_key;
--> statement-breakpoint
ALTER INDEX public."Song_albumId_idx" RENAME TO song_album_id_idx;
--> statement-breakpoint
ALTER TABLE public.song ADD CONSTRAINT song_album_id_fkey FOREIGN KEY (album_id) REFERENCES public.album(id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE public.profile ADD CONSTRAINT profile_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(id) ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE public.password_credential ADD CONSTRAINT password_credential_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(id) ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE public.admin_mfa ADD CONSTRAINT admin_mfa_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(id) ON DELETE RESTRICT;
--> statement-breakpoint
DROP SEQUENCE public."Album_id_seq", public."Song_id_seq";
--> statement-breakpoint
CREATE FUNCTION pg_temp.uuid_legacy_payload(row_data jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_object_agg(CASE key
    WHEN 'image_url' THEN 'imgUrl' WHEN 'release_date' THEN 'releaseDate'
    WHEN 'is_visible' THEN 'isVisible' WHEN 'created_at' THEN 'createdAt'
    WHEN 'youtube_id' THEN 'youtubeId' WHEN 'has_official_cheer' THEN 'hasOfficialCheer'
    WHEN 'is_title' THEN 'isTitle' WHEN 'sort_order' THEN 'order' WHEN 'updated_at' THEN 'updatedAt'
    ELSE key END, value)
  FROM jsonb_each(row_data - 'id' - 'album_id')
$$;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    (SELECT id, payload FROM pg_temp.uuid_cutover_album_payload EXCEPT SELECT id, pg_temp.uuid_legacy_payload(to_jsonb(a)) FROM public.album a)
    UNION ALL
    (SELECT id, pg_temp.uuid_legacy_payload(to_jsonb(a)) FROM public.album a EXCEPT SELECT id, payload FROM pg_temp.uuid_cutover_album_payload)
  ) OR EXISTS (
    (SELECT id, album_id, payload FROM pg_temp.uuid_cutover_song_payload EXCEPT SELECT id, album_id, pg_temp.uuid_legacy_payload(to_jsonb(s)) FROM public.song s)
    UNION ALL
    (SELECT id, album_id, pg_temp.uuid_legacy_payload(to_jsonb(s)) FROM public.song s EXCEPT SELECT id, album_id, payload FROM pg_temp.uuid_cutover_song_payload)
  ) THEN RAISE EXCEPTION 'UUID_CUTOVER_PAYLOAD_CHANGED'; END IF;
END $$;
--> statement-breakpoint
DROP FUNCTION pg_temp.uuid_cutover_id(text, bigint), pg_temp.uuid_legacy_payload(jsonb);
