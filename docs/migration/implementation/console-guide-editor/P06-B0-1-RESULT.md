---
title: "P06-B0-1 Metadata 차단 코드 검증 결과"
kind: migration-result
status: active
source_commit: 0da834d57017c403c58f52f31e2bf0f3b98392e3
verified_at: "2026-10-13"
updated_at: "2026-10-13"
revision: 1
---

# P06-B0-1 결과

**코드 구현·로컬 검증 완료, 실제 VM 적용·지속성 증거는 대기 중이다.**
[B0 계획](P06-B0-PLAN.md)의 B0-1만 구현했다. #135 병합 head `9a31a90`에서
`feature/p06b0-metadata-guard`를 분기했다. 검증 코드 ref는 위 source_commit이다.

전용 nft table의 atomic 갱신·drift 검사, Docker 이전 guard 의존/시작 전 검사,
별도 승인 installer와 직접 HTTP probe를 추가했다. probe는 host v2 양성 대조·container v1/v2
여섯 경로의 네트워크 실패·counter 증가를 요구하고 body·원문 진단은 출력하지 않는다.
mount/추가 capability/privileged/비bridge 실행을 거절한다. 일반 배포·installer·IAM은 변경하지 않았다.
Runtime/Deployment와 index에 경계를 반영했고 명시적 적용·복구는 [운영 절차](../../../../ops/oci/README.md#7-p06-metadata-차단)가 소유한다.

| 실제 실행                                                                                                       | 결과                                                                                                                                                                              |
| --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm type-check`, `pnpm test:harness`, `pnpm lint`, `pnpm lint:fsd`, `pnpm test:unit:run`, `pnpm format:check` | 전부 통과. harness 18건, workspace unit 459건, unit cache hit 0                                                                                                                   |
| `pnpm test:ops`                                                                                                 | 82건 통과. 신규 12건: drift·Python optimization·host/HTTP 상태·counter·입력 거절·출력 보호                                                                                        |
| `env -u DATABASE_URL -u AUTH_SECRET -u CONSOLE_AUTH_SECRET -u CONSOLE_MFA_ENCRYPTION_KEY pnpm build`            | 두 앱 build 성공, runtime secret 없이 실행, build cache hit 0                                                                                                                     |
| 격리 Docker namespace 실증                                                                                      | 적용 전 app→모의 IMDS 성공, 적용 후 여섯 경로 timeout·counter 증가·host HTTP 200·다른 목적지 통신 유지. 재적용·실패한 동일 table batch 후 기존 규칙/counter 보존, 별도 table 유지 |
| `systemd-analyze verify`, Bash/Python 구문·문서 링크/diff 검사                                                  | guard 및 Docker stub/drop-in 구문 통과. 실제 systemd boot/restart 검증은 아님                                                                                                     |
| commit hook                                                                                                     | lint-staged ESLint/Prettier·commitlint 통과. push hook은 실행 후 PR 본문에 별도 기록                                                                                              |

namespace 실증의 Docker inspect/exec dispatch는 mock이며 HTTP·nft·forward 경로는 실제로 실행했다.
fixture의 curl 누락·테스트 작성 중 문법/모듈 규칙은 수정 후 재검증했다. 임시 container는 제거됐다.
실제 OCI Instance Principal pull/Secret 읽기나 Docker/VM 재시작을 이 실험으로 검증했다고 주장하지 않는다.

운영 SSH 조회는 호스트명 해석 실패·공개 주소의 publickey 인증 거절로 원격 명령이 실행되지 않았다.
접속 방식 확인 또는 사용자 직접 읽기 점검 후 실제 host diff를 검토한다. 설치·IAM/Stack·DB 변경,
키 재생성·Secret 조회·전체 ARM64 빌드는 미실행이다. 사용자 P06-PLAN 수정·개인 env·키는 보존했다.
Web 실제 차단·지속성 proof 전 새 Console grant를 추가하지 않는다. B0-2 권한 실증 후만 B1을 허용한다.
현재 진입점은 기존 [HANDOFF](P06-HANDOFF.md) 한 파일을 갱신한다.
