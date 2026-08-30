---
title: "M5 Auth/Authz Preflight"
document_id: "M5-AUTH-PREFLIGHT"
version: "1.0"
status: "completed"
authority: "plan"
updated_at: "2026-08-30"
depends_on:
  - "M4-API-CONTRACT-RESULT"
  - "04"
  - "DOMAIN-SPECIFICATION"
---

# M5 Auth/Authz Preflight

## 1. 목적과 범위

M5 구현 전에 현재 Supabase 의존성을 인증과 Storage로 분류하고, Auth.js Credentials와
RequestContext가 사용할 identity/role schema 및 migration 순서를 확정한다.

이 checkpoint는 문서 작업만 수행한다. 다음 변경은 포함하지 않는다.

- Auth.js, Argon2, CASL package 설치
- Drizzle schema 또는 migration SQL 생성
- 로그인·로그아웃·Proxy·admin layout 교체
- production DB 연결, schema 관찰 또는 migration 적용
- Supabase Storage provider 변경

## 2. 기준 상태

- 기준 브랜치: `migration_develop`
- 기준 커밋: `8d5eaba`
- 작업 브랜치: `migration_m5-auth-preflight`
- M4 공개 조회 경계는 완료됐고 admin mutation API는 M5 이후로 보류돼 있다.
- repository의 Drizzle schema와 migration에는 `Album`, `Song`만 존재한다.
- Account, Profile, PasswordCredential, role persistence는 아직 없다.

## 3. 현재 Supabase 의존성 인벤토리

| 책임 | 현재 위치 | 현재 동작 | M5 처리 |
|---|---|---|---|
| 로그인·로그아웃 | `src/features/auth/api/actions.ts` | Supabase password sign-in/sign-out, metadata role 확인 | Auth.js Credentials로 교체 |
| 로그인 UI | `src/features/auth/ui/LoginForm.tsx` | Server Action 호출, Supabase 오류 문구 표시 | Auth.js sign-in contract로 교체 |
| 관리자 entry gating | `src/app/(admin)/admin/layout.tsx` | Supabase user와 `app_metadata.role` 확인 | RequestContext/Ability 기반으로 교체 |
| 세션 갱신 | `proxy.ts`, Supabase middleware client | 모든 matcher 요청에서 `getUser()` 호출 | Auth.js UX redirect만 남기거나 필요 없으면 축소 |
| Server client | `src/shared/api/db/supabase/server.ts` | Auth와 Storage가 함께 사용 | Auth consumer 제거 후 Storage 전용 경계로 격리 |
| Browser client | `src/shared/api/db/supabase/client.ts` | 직접 consumer 없음 | Auth 제거 checkpoint에서 삭제 후보로 재확인 |
| 이미지 업로드 | `src/features/manage-album/api/upload-album-image-action.ts` | `images` bucket upload/public URL | M8까지 동작 보존 |
| package | `@supabase/ssr`, `@supabase/supabase-js` | Auth SSR와 Storage SDK 제공 | SSR은 M5 제거, JS SDK는 Storage 때문에 유지 |
| 환경변수 | Supabase URL/anon key | Auth와 Storage가 같은 provider config 사용 | M5에서 삭제하지 않고 M8에서 재분류 |

결론:

```text
Supabase Auth
→ M5에서 제거

Supabase Storage
→ M8까지 격리 유지

@supabase/supabase-js
→ Storage consumer가 남으므로 M5에서 삭제 금지
```

## 4. Identity와 session 결정

### 4.1 Auth.js boundary

- Provider는 Credentials 하나로 시작한다.
- `authorize()` 입력은 `unknown`으로 보고 Zod로 검증한다.
- 로그인 실패는 계정 존재 여부, 비밀번호 오류, 비활성 상태를 구분해 노출하지 않는다.
- PasswordCredential의 Argon2id PHC 문자열을 검증하고 성공 시 Account identity만 반환한다.
- session strategy는 `jwt`를 명시한다.
- Auth.js adapter와 DB session table은 M5 v1에서 사용하지 않는다.
- JWT/session에 넣는 application identity는 `userId` 하나다.
- bigint Account id는 session boundary에서 10진수 string으로 직렬화한다.
- role, status, CASL rules는 JWT에 넣지 않는다.

Auth.js의 Credentials `authorize()`는 입력을 자동 검증하지 않으며 성공 시 user, 실패 시 `null` 또는
Credentials error를 반환한다. JWT callback의 반환값은 token에 저장되고 session callback에서
client 노출값을 명시적으로 선택할 수 있다. 구현 checkpoint에서 설치 버전의 공식 API를 다시
확인한다.

### 4.2 RequestContext boundary

```text
Auth.js JWT userId
        ↓
Account ACTIVE 확인
        ↓
role 조회
        ↓
CASL rules/Ability 생성
        ↓
RequestContext { user, ability }
```

비활성 상태는 `SUSPENDED`, `DELETED`, 존재하지 않는 Account를 포함한다. 이 경우 authenticated
RequestContext를 만들지 않는다. mutable authorization facts는 다음 요청부터 DB 값으로 반영한다.

## 5. v1 persistence schema

새 테이블의 물리 이름은 lowercase snake_case를 사용한다. 기존 quoted `Album`/`Song` 이름을
M5에서 바꾸지 않는다. 새 PK는 PostgreSQL identity `bigint`, 시간은 `timestamptz`, 문자열은
길이 제한의 제품 근거가 없는 한 `text`를 사용한다.

### 5.1 `account`

| column | type/constraint | 의미 |
|---|---|---|
| `id` | bigint identity PK | 내부 Account identity |
| `role` | text NOT NULL, `USER/REVIEWER/ADMIN` check | 단일 v1 role |
| `status` | text NOT NULL, Account status check | `PENDING_VERIFICATION/ACTIVE/SUSPENDED/DELETED` |
| `created_at` | timestamptz NOT NULL default now | 생성 시각 |
| `deleted_at` | timestamptz nullable | tombstone 전환 시각 |

`Account`는 물리 삭제하지 않는다. `role`은 DOMAIN_SPECIFICATION의 단일 role 모델을 따른다.
별도 `role`, `account_role` table이나 복수 role 배열은 만들지 않는다. Role 변경은 `account.role`
변경이며, M7 이전 실제 운영 변경이 필요하면 같은 use case에서 AuditLog 도입 시점도 함께 정한다.

### 5.2 `profile`

| column | type/constraint | 의미 |
|---|---|---|
| `account_id` | bigint PK/FK → account.id, ON DELETE RESTRICT | Account와 1:1 |
| `nickname` | text NOT NULL UNIQUE | 공개 nickname |
| `avatar_url` | text nullable | 공개 avatar |
| `updated_at` | timestamptz NOT NULL default now | 변경 시각 |

탈퇴는 row 삭제가 아니라 nickname을 Account id 기반 tombstone 값으로 교체하고 avatar를
비운다. 과거 nickname을 일반 화면에 유지하지 않는다.

### 5.3 `password_credential`

| column | type/constraint | 의미 |
|---|---|---|
| `account_id` | bigint PK/FK → account.id, ON DELETE RESTRICT | Account와 1:1 |
| `email` | text NOT NULL UNIQUE | lowercase/trim canonical email |
| `password_hash` | text NOT NULL | Argon2id PHC 문자열 |
| `email_verified_at` | timestamptz NOT NULL | 검증 완료 시각 |
| `password_changed_at` | timestamptz NOT NULL | 최종 비밀번호 변경 시각 |
| `updated_at` | timestamptz NOT NULL default now | credential 변경 시각 |

Service는 email을 trim/lowercase로 canonicalize한다. DB migration에는 `email = lower(btrim(email))`
check를 포함해 우회 write도 같은 표현을 유지한다. 평문 password와 hash를 log, fixture, migration
SQL, Git history에 넣지 않는다.

### 5.4 Assignment와 locale 제외

DOMAIN_SPECIFICATION의 v1 권한은 `USER/REVIEWER/ADMIN` 전역 role로 정의돼 있다. album 단위
assignment가 권한에 미치는 효과는 정의돼 있지 않고, locale 기반 콘텐츠·권한도 현시점에서
지원하지 않는다.

따라서 M5 v1에는 다음 table/fact를 만들지 않는다.

- `role`, `account_role`: Account가 단일 `role` column을 소유한다.
- `account_album_assignment`
- `account_locale_assignment`
- locale enum/table/contract

04 Auth/Authz 문서의 editor/translator와 album/locale assignment는 CASL condition을 설명하기 위한
예시일 뿐 현재 제품 role/permission 계약이 아니다. 향후 scoped permission이 실제 제품 요구가
되면 DOMAIN_SPECIFICATION을 먼저 개정하고 schema, RequestContext, CASL rules, test를 같은 변경
단위에서 추가한다.

## 6. Constraint와 query plan 기준

- `profile.account_id`, `password_credential.account_id`는 PK가 FK index를 겸한다.
- RequestContext 조회는 Account/Profile/Credential 전체를 매번 읽지 않는다. Account status/role과
  필요한 최소 projection을 사용한다.
- 로그인 email 조회와 RequestContext authorization facts 조회를 분리한다. 비밀번호 hash는
  로그인 검증 경계 밖으로 전달하지 않는다.
- schema migration은 additive로 만들고 생성 SQL의 FK, check, unique, index를 직접 검토한다.

## 7. Supabase Auth cutover 계획

### 7.1 Expand

1. Drizzle schema에 identity table과 단일 Account role column을 추가한다.
2. migration을 생성하고 SQL을 review한다.
3. local Docker PostgreSQL에 명시적으로 적용한다.
4. repository/service integration test로 constraint와 lookup을 검증한다.

### 7.2 Credential provisioning

Supabase password hash를 Argon2id hash로 간주하거나 그대로 복사하지 않는다. 기존 사용자는 승인된
identity manifest를 기준으로 새 Account/Profile을 매핑하고, 비밀번호는 별도의 one-time
provisioning/reset 절차로 Argon2id hash를 생성한다.

- 평문 password를 파일, CLI history, SQL migration, log에 남기지 않는다.
- provisioning 입력과 결과에 production credential을 포함하지 않는다.
- 사용자별 mapping과 초기 ADMIN 지정은 배포 runbook의 수동 승인 gate를 거친다.
- 실제 대상 사용자 목록은 이 preflight에서 production Auth를 조회해 만들지 않는다.

### 7.3 Application cutover

1. Auth.js Credentials/JWT와 Argon2id 검증을 구축한다.
2. 로그인·로그아웃 entry를 교체한다.
3. RequestContext와 `requireUser()`를 구축한다.
4. CASL rules와 permission test를 구축한다.
5. admin service, Route Handler, RSC/layout에 실제 보안 경계를 적용한다.
6. FE Ability와 403 self-healing을 연결한다.
7. Supabase Auth consumer와 SSR middleware를 제거한다.
8. Storage 전용 Supabase adapter와 SDK는 M8까지 남긴다.

### 7.4 Rollback

- schema는 additive이므로 cutover 전 Supabase Auth path를 제거하지 않는다.
- application rollback 시 신규 identity table은 미사용 상태로 남길 수 있다.
- Auth.js 검증과 admin smoke가 통과한 뒤에만 Supabase Auth path를 제거한다.
- destructive schema cleanup은 M5 rollback 범위에 포함하지 않는다.

## 8. 후속 작은 PR 순서

1. `migration_m5-auth-schema`: Drizzle identity schema와 migration, local DB test
2. `migration_m5-authjs-foundation`: Credentials, Argon2id, 최소 JWT, login/logout
3. `migration_m5-request-context`: ACTIVE Account와 role 조회, memoization, requireUser
4. `migration_m5-casl-policy`: 공용 ability 계약, rules, decision test
5. `migration_m5-security-boundaries`: service/RSC/Route Handler/admin layout 보호
6. `migration_m5-fe-ability`: serialized rules, UI gating, 403 self-healing
7. `migration_m5-remove-supabase-auth`: Auth SSR/proxy 제거, Storage adapter 유지

각 PR은 원칙적으로 생성 migration/lockfile을 제외하고 20파일/400줄 이하를 목표로 한다.

## 9. 검토 근거

- [Auth.js Credentials reference](https://authjs.dev/reference/core/providers/credentials)
- [Auth.js Next.js reference](https://authjs.dev/reference/nextjs)
- PostgreSQL schema 검토는 repository의 `supabase-postgres-best-practices` 중 data type, primary key,
  constraint, FK index 규칙을 적용했다.

## 10. Preflight 완료 조건

- [x] Supabase Auth 사용처와 Storage 사용처를 분류했다.
- [x] Account/Profile/PasswordCredential/role schema와 assignment 비도입을 확정했다.
- [x] 최소 JWT와 DB authorization facts의 수명주기를 분리했다.
- [x] production DB를 조회하지 않는 additive migration/cutover 순서를 정했다.
- [x] Supabase Storage와 JS SDK를 M8까지 유지하는 이유를 기록했다.
- [x] 후속 작업을 reviewable checkpoint로 나눴다.
