---
title: "Deployment / Migration Runbook"
document_id: "12"
version: "1.1"
status: "active"
authority: "runbook"
updated_at: "2026-08-29"
depends_on:
  - "01"
  - "02"
  - "03"
  - "04"
  - "05"
  - "06"
  - "07"
  - "08"
  - "09"
  - "10"
  - "11"
related: []
tags:
  - "migration"
  - "deployment"
  - "docker"
  - "oci"
  - "nextjs"
---

# oioi-bwg Deployment / Migration Runbook v1.1

## 1. 목적

이 문서는 설계 원칙을 실제 Vinext → Next.js 16 migration과 OCI deployment 순서로 변환한다.

DB data migration은 이미 완료된 상태를 전제로 한다.

---

## 2. 목표 Runtime

```text
Next.js 16 App Router
Node.js standalone
Docker
Caddy
OCI Compute Instance
PostgreSQL 17
```

---

## 3. Migration 기본 원칙

```text
runtime 먼저 정상화
architecture boundary 정리
server/data/auth 연결
observability/test
deployment
```

한 번에 전면 rewrite하지 않는다.

---

## 4. Phase M0 — Inventory

확인:

```text
routes
Vinext/Vite dependency
Cloudflare runtime dependency
current DB access
current Server Actions
auth
assets
env
tests
deployment files
```

삭제 대상과 유지 대상을 먼저 분류한다.

---

## 5. Phase M1 — Runtime Normalization

목표:

```text
Vinext → Next.js 16
Turbopack
standalone build
```

M1 DoD 후보:

```text
pnpm install
lint
test
build

zero Vinext runtime dependency
zero Vite runtime dependency
zero Cloudflare runtime dependency

viewer/mock/admin 화면이 **Next.js 16 runtime에서 crash 없이 렌더되고 기존 mock/temporary data path로 기본 interaction이 동작**
.next/standalone/server.js 실행
```

DB/Auth 연결 완료는 M1 필수 조건이 아니다. M1의 목표는 runtime/framework normalization이다.

---

## 6. Phase M2 — Structure

**M2 착수 전에 11의 URL locale 결정을 확정한다.**

02의 FSD 구조로 이동한다.

```text
src/app
src/widgets
src/features
src/entities
src/shared
src/server
```

route-local first / promotion by evidence 원칙을 지킨다.

---

## 7. Phase M3 — Server Foundation

06에 따라:

```text
DB singleton
Service
Repository
transaction boundary
DTO mapping
```

현재 staging의 query/command 혼합 책임을 정리한다.

---

## 8. Phase M4 — Data / API

03/05/07에 따라:

```text
Route Handler
ky
ApiError normalization
Zod contract
TanStack Query
RSC Service fetch
hydration
```

Next Data Cache는 사용하지 않는다.

---

## 9. Phase M5 — Auth/Authz

04에 따라:

```text
Auth.js
RequestContext
CASL
service security boundary
FE ability hydration
```

Proxy를 security boundary로 사용하지 않는다.

---

## 10. Phase M6 — Product Refactoring

실제 feature를 route-local first 원칙으로 정리한다.

기존 component를 line count만 보고 분해하지 않는다.

---

## 11. Phase M7 — State / Error / Test

08/09/10을 적용한다.

```text
RHF
nuqs
error UX
Sentry
logger
Vitest
RTL
Playwright
```

---

## 12. Phase M8 — Runtime / Asset Cleanup

11을 적용한다.

```text
env validation
asset path
11에서 선택된 storage provider의 deployment/credential 검증
Cloudflare/Supabase 잔재 제거
standalone runtime 확인
```

---

## 13. Phase M9 — Deployment

```text
Docker image build
Docker Compose
Caddy reverse proxy
HTTPS
health check
PostgreSQL connectivity
application startup
```

---

## 14. Docker

Docker/GHCR image portability는 11 §12.1의 `NEXT_PUBLIC_*` 원칙을 따른다.

Next standalone output을 기준으로 최소 runtime image를 구성한다.

container 안에 development toolchain 전체를 넣지 않는다.

---

## 15. PostgreSQL

PostgreSQL은 이미 OCI Docker 환경에 존재한다.

migration runbook에서는 다음만 확인한다.

```text
connection
schema compatibility
migration execution
backup
restore
health
```

data copy를 다시 수행하지 않는다.

---


## 15.1. Drizzle Migration Execution

DB schema migration 실행 시점은 12가 소유한다.

```text
DB backup
→ migration compatibility check
→ Drizzle migration 실행
→ application deploy
→ health verification
```

가능하면 expand / migrate / contract 순서를 따른다.

destructive migration과 application deploy를 하나의 irreversible step으로 묶지 않는다.

migration 실패 시 application deploy를 진행하지 않는다.

Migration 실행 주체는 CI 자동 단계 또는 수동 승인 단계 중 하나로 구현할 수 있다. 초기 운영에서는 production schema 변경에 수동 승인 gate를 두는 방식을 우선 고려한다.

---

## 16. Caddy

Caddy는 reverse proxy / TLS termination 역할을 맡는다.

application business logic을 proxy config에 넣지 않는다.

---

## 17. Health Check

최소 health endpoint 또는 container health mechanism을 둔다.

검증 후보:

```text
process alive
HTTP response
DB availability
```

모든 external dependency를 deep-check해서 health endpoint 자체를 불안정하게 만들지 않는다.

---

## 18. Backup / Restore

deployment 전에 PostgreSQL backup/restore 절차를 실제로 검증한다.

backup 존재만 확인하고 restore를 검증하지 않는 운영을 피한다.

---

## 19. Rollback

rollback 단위를 명시한다.

후보:

```text
previous Docker image
previous env/config
DB migration compatibility
```

destructive DB migration은 rollback 전략 없이 배포하지 않는다.

---


## 19.1. Deployment Downtime Policy

v1 single-instance deployment에서는 **짧은 maintenance downtime을 허용한다**.

목표는 무중단 deploy framework를 먼저 만드는 것이 아니라
rollback 가능한 단순 배포를 유지하는 것이다.

트래픽이 커져 downtime이 제품 요구를 침해할 때
blue/green, rolling, multi-instance를 별도 결정으로 검토한다.

---

## 20. Migration Compatibility Layer

일시적 adapter는 허용할 수 있다.

단 다음 조건을 가진다.

```text
삭제 시점 명확
소유 위치 명확
새 architecture에 침투하지 않음
```

temporary code를 영구 abstraction으로 승격시키지 않는다.

---


## 20.1. Test Infrastructure

10의 test architecture를 CI에 착지시킨다.

```text
CI
├─ PostgreSQL 17 test service/container
├─ migration/schema apply
├─ deterministic seed
├─ Vitest integration
├─ Next standalone test server
└─ Playwright
```

Production DB를 test target으로 사용하지 않는다.

---

## 21. CI/CD

최소 pipeline 후보:

```text
install
typecheck
lint
test
build
image build
deploy
health verification
```

구체 자동화는 실제 GitHub Actions/OCI 운영 방식에 맞춰 확정한다.

### Quality gate ordering

CI의 필수 게이트는 결정적이고 외부 서비스에 의존하지 않으며 로컬에서 같은 명령으로 재현
가능해야 한다. 기본 순서는 install → typecheck → lint/structure → unit/integration test →
format check → build로 고정하고, 한 단계가 실패하면 이후 단계를 성공으로 간주하지 않는다.
라이브 API drift, staging smoke test, 성능 측정처럼 네트워크나 환경 상태에 의존하는 검사는
필수 merge gate와 분리해 별도 job 또는 일정 실행으로 둔다.

---

## 22. Observability

production deploy 전에 최소:

```text
structured logs
Sentry
health check
startup failure visibility
```

를 확보한다.

---

## 23. Security

production checklist 후보:

```text
HTTPS
secure env
secret exposure check
DB external exposure check
auth cookie
container user
dependency audit
```

---

## 24. DoD

migration 완료 기준 후보:

```text
zero Vinext
zero Vite runtime dependency
zero Cloudflare runtime dependency

Next.js 16 standalone production boot
PostgreSQL 정상 연결
Auth 정상 동작
critical pages 정상 동작
critical mutations 정상 동작
Sentry/logging 정상
Docker restart 정상
Caddy HTTPS 정상
backup/restore 검증
rollback 방법 존재

배포 DoD에는 애플리케이션 health 확인, 핵심 익명·인증 사용자 smoke test, 이전 이미지로의
rollback 절차 확인을 포함한다. DB 변경이 있는 경우 backup 존재만 확인하지 않고 restore 또는
호환성 검증을 수행한다. 배포 후 stale asset/chunk가 발생했을 때 사용자를 무한 새로고침으로
몰아넣지 않도록 cache 정책과 복구 경로를 함께 점검한다.
```

---

## 25. 금지 패턴

```text
big-bang rewrite
DB data migration 재수행
temporary compatibility layer 영구화
deploy 전에 restore 미검증
Cloudflare runtime 잔재 방치
Next dev server를 production으로 사용
architecture docs와 다른 임시 shortcut을 설명 없이 영구화
```

---

## 26. 최종 원칙

1. Runtime normalization을 먼저 한다.
2. Architecture migration은 단계적으로 진행한다.
3. DB data migration은 이미 완료된 것으로 본다.
4. Vinext/Vite/Cloudflare runtime dependency를 제거한다.
5. Next standalone production runtime을 기준으로 한다.
6. Service/Repository/API/Auth boundary를 순서대로 연결한다.
7. Test/observability 없이 production migration을 완료로 보지 않는다.
8. Docker + Caddy + OCI를 deployment baseline으로 한다.
9. Backup뿐 아니라 restore를 검증한다.
10. Rollback 가능한 deployment를 만든다.
11. Temporary adapter는 삭제 계획을 가진다.
12. Runbook을 architecture를 우회하는 excuse로 사용하지 않는다.
