---
title: "P06-E2 Web 관리 경로 종료와 복구 차단 준비 결과"
kind: migration-result
status: partial
authority: evidence
source_commit: ed19b6d9f033009349708dc35cb7bed2cd7be5cd
created_at: "2026-10-21"
---

# P06-E2 결과

[P06 계획](P06-PLAN.md#4-pr별-구현-순서와-완료-조건)의 Web 관리 종료 checkpoint를 구현했다.
기준은 위 integration commit, 구현 commit은 이 결과가 포함된 PR head다.
가입 API 종료는 별도 [E1 결과](P06-E1-RESULT.md)/PR #168이다. 두 PR과 C/D 운영 증거가 갖춰진 후 실제 E를 적용한다.

## 변경

- Web의 /admin 전체, /admin-login, /api/admin/*, upload Action 및 연결된 관리 UI를 제거했다.
  Console의 관리 코드와 공용 server/contracts는 유지한다.
- 삭제한 UI가 유일한 consumer였던 관리 query/mutation과 client ability helper를 제거했다.
  공개 Album/Song DTO 조회와 cancellation/queryKey는 보존한다. Web 가사 reader는 공통 계약 type을 직접 사용한다.
- 기존 계정의 일반 로그인은 /login에서 유지한다. 로그인 UI를 route-private으로 두고,
  Auth.js Credentials HTTP API를 사용해 홈으로 이동한다. Web Server Action을 차단해도 일반 로그인이 가능하다.
- image/env rollback 밖에 유지할 [host 차단 설정과 절차](../../../../ops/oci/web-retirement.md)를 준비했다.
  관리·가입 URL, 모든 Next-Action, Auth.js callback/signout 외 쓰기를 upstream 전에 차단한다.
  실제 VM에 설치하거나 Caddy를 reload하지 않았다.
- 브라우저 smoke는 Console CRUD와 Web 거부/일반 로그인/공개 조회를 검증하도록 전환했다.
  실제 Caddy 검증을 CI의 Admin migration integration에 연결했다.

관리 경로와 그 의존 그래프를 함께 제거하므로 파일/라인 목표를 초과한다. 대부분 기존 Web 관리 복사본 삭제다.
분리 가능한 가입 종료는 E1로 분리했다. 이 checkpoint는 route/API/Action의 완전한 부재와
연결 코드 제거를 함께 검증한다. 리뷰 순서는 route/API/Action 삭제 → 일반 로그인/공개 entity API →
관리 전용 UI 삭제 → smoke → proxy/운영 절차다. 기존 Console 사본과 의존성 버전은 바꾸지 않는다.

## 실제 검증

- type-check·lint/FSD·unit 418건·harness 18건·format 성공.
- ops 211건 전체 성공. 두 앱 production build 성공; 마지막 로그인 파일 이동 뒤 Web 재빌드와 Console 검증 캐시 사용.
- `tsx scripts/run-postgres-integration-tests.ts --local --admin-smoke` 성공.
  guest/USER/ADMIN의 관리 route·API와 이전 upload Action을 거부하고 Album/Song 상태 불변을 확인했다.
  일반 USER/ADMIN 로그인, Console CRUD·가사 편집/저장·회수/재인증, 공개 Web 조회와 교차 세션 거부를 확인했다.
  종료 후 연결/잠금 0, 격리 DB/역할 정리 완료.
- 이전 upload Action ID는 2026-10-21 현재 VM Web manifest에서 해당 export만 READ ONLY로 추출했다.
  release 18462a4004780a0b43bcadf77792ef8fa22b082390498774331ed2a704a31c1a의 공개 식별자이며 credential이 아니다.
  새 build manifest에 upload Action이 없고, 이전 ID를 /·/login·/admin/albums로 보내도 404였다.
- `node tests/ops/web-retirement-proxy-smoke.mjs` 성공.
  digest로 고정한 Caddy 2.10.2가 관리/가입/encoded path/헤더 및 multipart Action을 403으로 거부했고,
  가짜 이전 upstream에 도달한 거부 요청은 0이었다. 일반 조회 및 Auth.js POST는 통과했다.
  Docker Desktop의 별도 localhost 문제를 피하도록 공식 바이너리를 추출해 같은 WSL localhost에서 검사한다.
- 로컬 browser 아티팩트는 `/tmp/oioi-p04-smoke-HAjiW8`다. 일반 로그인 화면을 별도 production 실행으로
  캡처/시각 확인했고 CI에서도 로그인 및 로그인 후 화면을 캡처한다.

## 적용 대기

C HTTPS의 실제 사용자 로그인과 D의 실물 인증기 reset/재등록/회수·관리·복구 증거가 남았다.
이후 실제 host에 지속적인 Web 차단을 설치하고 current/previous pair 모두에서 검증한 뒤 E Promotion을 진행한다.
안전한 previous pair가 없으면 maintenance를 유지한다. 지금은 코드/로컬 검증 준비이며 E 운영 완료가 아니다.
www 전환·레거시 종료·Console 공개를 포함한 F는 사용자 귀가 후로 보류한다.
