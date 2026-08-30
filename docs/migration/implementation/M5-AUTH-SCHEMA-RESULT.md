---
title: "M5 Auth Schema Result"
document_id: "M5-AUTH-SCHEMA-RESULT"
version: "1.0"
status: "completed"
authority: "result"
updated_at: "2026-08-30"
depends_on:
  - "M5-AUTH-PREFLIGHT"
---

# M5 Auth Schema Result

## 완료 범위

M5 Auth.js/RequestContext의 persistence 기반으로 다음 세 테이블을 추가했다.

```text
account
├─ profile
└─ password_credential
```

- `account`: bigint identity, 단일 `USER/REVIEWER/ADMIN` role, Account status, tombstone 시각
- `profile`: Account 1:1 공개 프로필, unique nickname, nullable avatar URL
- `password_credential`: Account 1:1 canonical email, Argon2id PHC hash 저장 필드와 변경 시각

locale, album/locale assignment, 복수 role, Auth.js adapter/session table은 추가하지 않았다.

## Persistence 결정

- 신규 물리 식별자는 lowercase snake_case를 사용한다.
- Account PK/FK는 PostgreSQL `bigint`이며 TypeScript에서는 `bigint`로 다룬다.
- 외부 session boundary에서는 Account id를 10진수 string으로 직렬화한다.
- role/status는 text + check constraint로 도메인 vocabulary를 제한한다.
- `DELETED`와 `deleted_at` 존재 여부가 항상 일치하도록 check constraint를 둔다.
- email은 unique이며 lowercase/trim canonical 표현을 DB check로 보호한다.
- password hash는 비어 있을 수 없고 평문 password는 schema/migration에 포함하지 않는다.
- Profile/Credential FK는 Account 물리 삭제를 `RESTRICT`한다. Account 탈퇴는 tombstone workflow다.
- FK column은 각 child table의 PK이므로 별도 중복 index를 추가하지 않았다.

## Migration

Drizzle Kit으로 `0001_concerned_vapor.sql`과 snapshot/journal을 생성했다. 생성 SQL을 직접 검토해
다음을 확인했다.

- table 3개
- PK 3개
- FK 2개, `ON DELETE RESTRICT`
- unique 2개
- check 5개
- `timestamptz`와 `bigint GENERATED ALWAYS AS IDENTITY`

이 migration은 기존 Album/Song을 변경하지 않는 additive migration이다.

## 로컬 PostgreSQL 검증

Docker Compose PostgreSQL 17에 localhost URL을 명시하고 local database guard를 통과한 뒤
`pnpm db:migrate`를 실행했다.

Transaction 안에서 다음을 검증하고 rollback했다.

- 정상 ADMIN Account/Profile/PasswordCredential insert
- `EDITOR` role 거부
- `DELETED`인데 `deleted_at`이 없는 Account 거부
- uppercase email 거부
- Profile/Credential이 존재하는 Account delete 거부
- rollback 후 Account row 0건

production DB에는 연결하거나 migration을 적용하지 않았다.

## 후속 범위

다음 PR은 Auth.js Credentials, Argon2id 검증, 최소 JWT와 로그인·로그아웃 경계만 구축한다.
RequestContext, CASL, service security boundary, Supabase Auth 제거는 이후 작은 checkpoint로 유지한다.
