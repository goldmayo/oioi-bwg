---
title: "M9 OCI Development Runtime Plan"
document_id: "M9-OCI-DEVELOPMENT-RUNTIME-PLAN"
version: "1.1"
status: "superseded"
authority: "plan"
updated_at: "2026-09-10"
source:
  repository: "goldmayo/oioi-bwg"
  branch: "migration_develop"
  commit: "2f0cf79619d850b2481ca97430dfe57dfd8b3368"
depends_on: ["01", "11", "12"]
related: ["M1-RUNTIME-NORMALIZATION-RESULT", "M7-FINAL-VERIFICATION"]
superseded_by: "M9-CICD-OCI-OPERATIONS-PLAN"
---

# M9 OCI Development Runtime Plan

> **Supersession notice (2026-09-10)**
> 이 문서는 PR 73 최초 구현의 계획과 provenance를 보존하는 historical artifact다. GHCR 직접
> publish/deploy 결정은 `M9-CICD-OCI-OPERATIONS-PLAN` 및 active architecture 01/11/12에 의해
> 대체되었으며 현재 구현 authority가 아니다. 아래 본문은 당시 계획을 재작성하지 않고 보존한다.

## 목적과 범위

운영 cutover 전에 OCI Compute에서 현재 Next.js 16 standalone 애플리케이션을 개발용 컨테이너로
기동하고, 기존 PostgreSQL 17 연결과 HTTP health를 검증한다.

```text
GHCR immutable development image
  -> OCI Docker Compose
  -> Next.js standalone server.js
  -> existing PostgreSQL 17 container
```

포함 범위:

- standalone multi-stage image, non-root runtime, `public`과 `.next/static`
- HTTP liveness와 `SELECT 1` 기반 PostgreSQL readiness
- 기존 PostgreSQL external Docker network를 사용하는 app-only Compose
- commit SHA로 고정한 multi-platform GHCR image와 OCI deploy script

Non-goals:

- Caddy, HTTPS, DNS 또는 production traffic cutover
- DB data copy, schema migration, destructive DDL
- production backup/restore/rollback 완료 판정
- M8 전체 env/storage cleanup 완료 판정

## Authority와 evidence

- Architecture 01: OCI의 Caddy → Next standalone → PostgreSQL 구조
- Architecture 11: Next.js 16, Node standalone, Docker, OCI와 env 분리
- Architecture 12 §13~17, §21, §23: 최소 image, Compose, DB connectivity, health, GHCR, container user
- Pinned AS-IS `2f0cf79619d850b2481ca97430dfe57dfd8b3368`: standalone 설정과 local smoke는 있으나
  production-style image, OCI Compose, health route, GHCR workflow는 없다. DB 기반 sitemap은 dynamic
  config 없이 build-time prerender를 시도한다.
- 2026-09-09 user-confirmed OCI baseline: 2 OCPU, 12 GB RAM, 100 GB disk, Docker/Compose,
  PostgreSQL 17와 `pg_stat_statements`; DB data 이전 완료.

OCI에서 직접 확인할 unknown:

- CPU architecture, SSH host/user, application path
- PostgreSQL Docker network와 container DNS/port
- development `DATABASE_URL`과 runtime env file
- GHCR visibility와 pull credential

## 구현 전략

1. DB 기반 sitemap을 runtime dynamic route로 명시해 image build의 DB 의존을 제거한다.
2. standalone output과 정적 asset만 non-root runtime image에 복사한다.
3. `/healthz`는 DB 없는 liveness, `/readyz`는 detail-free PostgreSQL readiness로 둔다.
4. Compose는 app만 소유하고 exact image와 기존 external DB network를 필수 입력으로 받는다.
5. Caddy 전 host bind는 `127.0.0.1:3000`을 기본으로 한다.
6. migration branch에는 `dev-<full SHA>`, `migration_develop`에는 추가로 `development` tag를 게시한다.
7. `linux/amd64`, `linux/arm64` manifest를 함께 게시한다.
8. OCI deploy는 config → pull → up/health wait 순서로 실행한다.

## 위험과 중단 조건

- network/container 이름과 credential을 추측하거나 Git, image layer, workflow log에 기록하지 않는다.
- development image의 `NEXT_PUBLIC_*`는 build-time 고정하며 production 승격에 사용하지 않는다.
- DB schema mismatch가 보이면 migration을 자동 실행하지 않고 별도 승인 단계로 넘긴다.
- Caddy/HTTPS는 후속 M9 concern으로 분리한다.

## Definition of Done

- DB/secret 없이 image build, non-root `node server.js`, GHCR exact-SHA publish가 성공한다.
- Compose가 기존 DB network를 재사용하고 DB container/data를 만들거나 변경하지 않는다.
- OCI에서 `/healthz`와 `/readyz`가 200이고 restart 후 healthy로 복구된다.
- 잘못된 DB 연결에서 `/readyz`는 detail-free 503을 반환한다.
- 실행 source, image digest, 검증 결과와 remaining gaps를 별도 RESULT에 기록한다.

## Verification

Repository/CI: `pnpm verify`, `pnpm format:check`, `pnpm build`, `docker build`, Compose config,
runtime file/env exclusion, `argon2`, liveness/readiness smoke.

OCI: Docker/Compose version, `uname -m`, external network inspect, image pull, Compose up/wait, health/readiness,
restart recovery. Production credential, schema mutation, Caddy, HTTPS는 검증하지 않는다.
