---
title: "P06-E1 공개 가입 접수 종료 결과"
kind: migration-result
status: partial
authority: evidence
source_commit: ed19b6d9f033009349708dc35cb7bed2cd7be5cd
created_at: "2026-10-21"
---

# P06-E1 결과

[P06 계획](P06-PLAN.md#web-관리-종료-이후의-안전한-rollback)의 가입 종료 concern을 별도 구현했다.
위 integration 기준에서 분기했으며 검증한 구현 commit은 이 결과가 포함된 PR head로 식별한다.
실제 배포는 C/D Console 운영 검증과 E의 지속적인 rollback 차단 준비가 끝난 뒤 진행한다.

- 기존에 가입 페이지는 없었으나 OTP 발송·검증·완료 POST는 열려 있었다.
  세 handler를 입력과 관계없이 403 FORBIDDEN/no-store로 응답하는 경계로 교체했다.
  body parsing·메일/OTP/Account service 호출을 하지 않는다.
- DOMAIN AUTH-001에 공개 접수 중단과 기존 Account 로그인·조회 보존을 명시했다.
  기존 가입 방식/프로세스와 shared service를 새 관리자 생성 정책으로 바꾸지 않았다.
- 종료한 positive route test는 서비스 미호출 검사로 바꾸고, 실제 standalone smoke에
  유효한 VERIFIED 증명 재전송 및 malformed JSON 검사·DB 전후 비교를 추가했다.

## 실제 검증

- type-check·lint/FSD·unit 476건·harness 18건·format 성공, 두 앱 production build 성공.
- ops 211건: 첫 실행에서 jq PATH 누락으로 paired Run Command 16건이 실패했다.
  다른 195건은 성공했고, 기존 jq 경로를 포함해 해당 파일 24건 전체를 재실행해 성공했다.
- `tsx scripts/run-postgres-integration-tests.ts --local --admin-smoke` 성공.
  세 API의 정상 형식·malformed 요청 모두 403, no-store를 확인했다.
  VERIFIED 증명과 Account/credential/profile/challenge/rate-limit 개수·상태가 변하지 않았다.
  메일 발송 경로의 service 미호출은 별도의 mock 단위 검사로 확인했다.
- 같은 브라우저 실행에서 기존 Web·Console 관리 CRUD, 일반 Web 조회, Console 등록·회수와
  세션 경계도 통과했다. fixture 인증기/OTP를 사용한 로컬 검사이며 실물 운영 검증과 구분한다.
- 아티팩트: 로컬 `/tmp/oioi-p04-smoke-GKMl6y`. 종료 후 DB 연결/잠금 0, 임시 DB·역할 정리 확인.

Web 관리 화면/API/Action 제거와 image rollback 시 외부 차단은 E의 다른 concern이다.
이 PR만으로 E 전체 완료나 실제 공개 가입 중단을 보고하지 않는다. F는 보류한다.


## 2026-10-21 최신 통합선 반영

기준 `e2631de9161dd58612706151dc9517f3fe8d8910`의 로그인 UX·캐시 축소·관리자 자동 E2E 제외와
임시 workflow 정리를 반영했다. 가입 종료의403/no-store·service 미호출·기존 계정 보존 계약은 변경하지 않았다.
frozen lockfile 설치는 성공했다. 최종 통합 기준과 새 CI의 head/결과는 #168 본문에서 추적한다.
코드 병합은 VM 배포가 아니며, 실제 E 적용은 D 운영 실증·지속적인 Web 차단·안전한 previous pair 확인 뒤
별도 Promotion으로 진행한다. 현재 VM의 가입 경로·Caddy·계정·MFA는 이번 작업에서 변경하지 않는다.
