---
title: Legacy Main Reverse Engineering Index
document_id: RE-MAIN-000
version: 0.1.0
status: draft
authority: plan
source:
  repository: goldmayo/oioi-bwg
  branch: main
  commit: 4b299934846f4a0eed7132f58c5b1c2a481a3739
---

## Change Log

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1.0 | 2026-09-05 | Codex | main commit 기준 Legacy AS-IS 문서 세트 인덱스 작성 |

# Legacy Main Reverse Engineering Index

## 1. 목적

이 문서 세트는 `goldmayo/oioi-bwg` 저장소의 main branch 고정 commit에 존재하는 마이그레이션 이전 시스템의 Legacy AS-IS를 독립적으로 기록한다.

```text
repository: goldmayo/oioi-bwg
branch: main
commit: 4b299934846f4a0eed7132f58c5b1c2a481a3739
```

현재 작업 트리의 다른 branch나 `migrated-current` 문서는 main 동작의 근거로 사용하지 않았다.

## 2. 범위

### 포함

- 실제 사용자 및 관리자 route/page/layout
- navigation과 화면 구조
- Supabase 기반 인증·세션 갱신 및 관리자 판별
- Server Action, RSC 직접 query, Drizzle command/query 경계
- DB schema, migration, FK, index, cache 동작
- Cloudflare Worker, Vinext, Vite, Wrangler, Hyperdrive, R2/Supabase Storage
- 환경변수 사용 위치
- 테스트와 CI/CD 설정

### 제외

- 이후 migration에서 추가된 기능
- 미래 도메인 및 To-Be 설계
- 코드에 없는 UX 개선
- `DOMAIN_SPECIFICATION.md` 및 미래 기능 문서
- main commit 이후 변경사항

## 3. Evidence 상태

| 상태 | 의미 |
|---|---|
| `confirmed` | main commit의 코드·설정·migration·test·workflow에서 직접 확인됨 |
| `inferred` | 여러 직접 근거를 종합한 합리적 해석 |
| `unknown` | 저장소 조사 후에도 운영 환경 또는 외부 설정만으로 남는 항목 |

## 4. Evidence 우선순위

```text
runtime code
> route/page/component/action
> server/data code
> schema/migration
> test
> config/workflow
> comment/documentation
```

주석이나 기존 문서가 코드와 다르면 코드·설정을 우선한다.

## 5. 문서 목록

| 문서 | 역할 |
|---|---|
| `00-index.md` | 기준 commit, 범위, 상태 및 문서 목록 |
| `01-ia-menu-structure.md` | main route·layout·navigation IA |
| `02-screen-id-list.md` | 실제 page 기준 화면 inventory |
| `03-access-control-structure.md` | Supabase session과 관리자 접근 구조 |
| `04-user-process-inventory.md` | 사용자·관리자 행동과 서버 경계 목록 |
| `05-screen-spec.md` | 화면별 As-Is UI 및 상태 명세 |
| `06-process-flow.md` | 실제 호출 순서와 mutation/cache 흐름 |
| `07-database-spec.md` | Drizzle schema와 DB 접근 구조 |
| `08-api-spec.md` | HTTP API와 Server Action/Worker 경계 |
| `09-runtime-infrastructure-inventory.md` | runtime·Cloudflare·환경·테스트·배포 inventory |

## 6. 핵심 baseline 관찰

- App Router page와 layout은 존재하지만 `src/app/api/**/route.ts` HTTP application API는 확인되지 않는다.
- 관리자 mutation은 Server Action에서 직접 Drizzle DB command를 호출한다.
- Supabase client는 Auth session 갱신·로그인·로그아웃과 앨범 이미지 Storage에 사용된다.
- Drizzle DB runtime은 `cloudflare:workers`의 `env.DB` Hyperdrive connection string을 우선 사용한다.
- 실제 runtime schema는 `src/shared/api/db/drizzle/schema.ts`의 `Album`·`Song` 두 테이블이다.
- `drizzle.config.ts`가 지정한 `src/libs/db/drizzle/schema.ts` 경로는 main tree에서 확인되지 않는다.
- 따라서 runtime schema, migration/tooling schema, Drizzle config가 하나의 schema SSOT로 정합되지 않은 Legacy baseline anomaly가 확인된다. 어느 정의가 운영 정답인지는 `unknown`이다.
- `updateTag`와 `revalidatePath`는 command 및 Server Action에서 직접 호출되지만 모든 read에 cache tag가 붙는 것은 아니다.
