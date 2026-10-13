---
title: "P06-B0-1 Metadata 차단 코드 검증 결과"
kind: migration-result
status: active
source_commit: 0da834d57017c403c58f52f31e2bf0f3b98392e3
verified_at: "2026-10-14"
updated_at: "2026-10-14"
revision: 5
---

# P06-B0-1 결과

**코드·보완 검증 및 실제 VM의 현재 Web 차단 1차 적용 완료, 재시작 지속성 증거는 대기 중이다.**
[B0 계획](P06-B0-PLAN.md)의 B0-1만 구현했다. #135 병합 head `9a31a90`에서
`feature/p06b0-metadata-guard`를 분기했다. 검증 코드 ref는 위 source_commit이다.
[구현 PR #136](https://github.com/goldmayo/oioi-bwg/pull/136)은 리뷰/CI 확인 대상이며 운영 적용 승인이 아니다.

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

초기 SSH 선택은 호스트명 해석·publickey 인증에 실패했다. 사용자가 지정한 기존 키 selector로
접속한 뒤 다음 설정을 읽기 조회했다. 키 원문·env·OCI 식별자는 출력/공개 문서에 복사하지 않았다.

| VM 관찰 출처                 | 결과와 적용안의 영향                                                                                                                                             |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 에이전트 SSH 읽기            | nft 1.0.9, iptables 1.8.10 `nf_tables`, Docker 29.7.2/live-restore=true. 표준 Docker unit 활성·drop-in 없음                                                      |
| 에이전트 container 선택 조회 | 기존 Web bridge driver, privileged=false·추가 cap 없음·mount 0. probe 실행 조건과 일치                                                                           |
| 에이전트 설정 읽기           | nftables service 비활성, ufw/firewalld 미설치. 기본 nftables.conf의 global flush 존재 → 기본 service 활성화/reload/stop 금지, 전용 guard만 사용                  |
| 사용자 sudo 읽기 요약        | 현재 ip/ip6 filter FORWARD priority 0, filter/nat/raw table만 존재, flowtable 0, 전용 inet guard table 없음. 새 -10 hook이 기존 forward보다 먼저 실행하도록 준비 |

이 계정의 sudo는 비밀번호를 요구한다. privileged 설치·probe·restart는 사용자 터미널에서
기존 sudo 인증으로 실행할 수 있게 준비하며 비밀번호 수집·NOPASSWD 확대는 하지 않는다.
설치용 archive는 검증 코드 ref의 guard/probe/installer/unit/drop-in 다섯 파일만 `git archive`로 만들었다.
B0 worktree의 `.local/p06b0-metadata-guard-0da834d.tar`, SHA-256
`cc605652825fda0f386df52afd5d3aa4f3981dad14f9f1c3274daf39fc00508a`다.
VM 업로드·설치·실제 Web probe의 1차 적용안으로 준비했으며 재시작 proof와 Console grant는 후속 승인 범위다.
읽기 조회는 설치 승인이나 실제 IMDS 차단 proof가 아니다. 설치·IAM/Stack·DB 변경,
키 재생성·Secret 조회·전체 ARM64 빌드는 미실행이다. 사용자 P06-PLAN 수정·개인 env·키는 보존했다.
Web 실제 차단·지속성 proof 전 새 Console grant를 추가하지 않는다. B0-2 권한 실증 후만 B1을 허용한다.
현재 진입점은 기존 [HANDOFF](P06-HANDOFF.md) 한 파일을 갱신한다.

## 2026-10-14 설치 경로 보완

#136의 병합 head `b8aa61be2594f6e95c5ceaf9de979033e742c08b`와 PR Verify 성공을
GitHub에서 확인했다. 사용자는 1차 파일 전달·백업·설치·현재 Web 검증을 승인했다.
기존 installer를 바로 설치하지 않고 SSH 읽기 조회를 재실행했다. 기존 Web bridge·mount 0·
추가 cap 없음·비privileged, Docker/live-restore·관리 service 상태는 이전 관찰과 같았다.
Web `/healthz`·`/readyz`는 body 없이 조회해 각각 HTTP 200, 두 container는 healthy였다.

`/srv/oioibawige` 및 scripts가 일반 사용자 소유/0750인 것을 확인했다. root 소유 파일만
두어도 이 상위 디렉터리를 통해 교체할 수 있어 guard를 root 보호 경로로 옮기는 보완을
먼저 구현한다. `/usr`·`/usr/local`·`/usr/local/lib`는 root:root/0755이고 새 guard 디렉터리는 없다.
설치 경로만 `/usr/local/lib/oioi-metadata-guard`로 변경하고 기존 배포 디렉터리 권한은 보존한다.
상위 경로·기존 파일의 비보호 소유권/쓰기 권한·symlink/hardlink는 변경 전에 거절한다.
기존 guard/probe의 네트워크 동작과 nft 규칙은 변경하지 않는다.

처음 격리 검증은 Docker WSL 통합 비활성으로 실행하지 못했다. 사용자 활성화 후
`docker run --rm --network none`으로 `tests/ops/metadata-install-container.sh --isolated-container`를
실행해 exit 0을 확인했다. 실제 파일 소유권·permission·symlink/hardlink를 사용해 여섯 거절
경로와 두 차례 설치를 검증했고 기존 scripts 소유권도 유지됐다. nft·curl·Docker·systemd
명령 dispatch는 mock이며 운영 nft 동작·systemd 지속성 검증을 대체하지 않는다.

보완 회귀 검사 포함 `pnpm test:ops` 90건, type-check·harness 18건·FSD·unit 459건·
format·두 앱 build가 성공했다. 새 worktree에서 cache hit 0으로 실행했다. 최초 lint는
harness가 생성한 의도적 위반 fixture를 동시에 읽어 실패했다. fixture의 생성/삭제 코드를
확인하고 harness 종료 후 lint 재실행은 성공했다. 이후 검사는 두 명령을 동시에 실행하지 않는다.
기존 archive는 #136의 다섯 파일과 동일하지만 보완 전 경로를 사용하므로 VM에 전달/설치하지 않았다.

보완 검증 소스는 `280710eb929f78aa7b7096d6bbaf1329aa2e7ef2`,
[PR #137](https://github.com/goldmayo/oioi-bwg/pull/137)이다. commit hook은 lint-staged/commitlint
성공, 첫 커밋 시도의 본문 줄 길이 초과는 줄바꿈 후 해소했다. push hook은 affected task 0과
repo 검사·harness 18건·ops 90건·format 성공으로 직접 전체 검사와 구분한다.

사용자가 승인한 파일 전달을 수행했다. `git archive`로 소스의 다섯 설치 파일만 묶고
VM의 새 사용자 작업 디렉터리(0700)에 archive와 1차 실행 스크립트(각 0600)를 전달했다.
archive SHA-256은 `93f742f415d7208ee065ef52fe575541a4bb8ad1b75f0c9c889be83476c77302`,
1차 실행 스크립트 SHA-256은 `3973538f8ee5ec3803c940ed16c780ce7350043c9ecd76dcc2d10cefb6402ea1`이며
전송 후 VM에서 일치를 확인했다. 실행 스크립트의 Bash 구문도 원격에서 확인했다.
정확한 명령/실행 파일은 보완 worktree의 ignored `.local/first-phase.sh`에 있다.
실행 시 root 전용 백업·현재 firewall 대조·host IMDS 양성 대조·guard 설치·현재 Web probe·
DNS/outbound·health·Docker/Web 시작 시각 유지 검사를 수행하도록 준비했다.
실제 sudo 실행 결과는 아직 없으므로 root 백업·설치·Web 차단 성공으로 기록하지 않는다.
운영 firewall·unit·IAM/Stack·DB 변경은 아직 미실행이다. 운영 재시작은 별도 승인 범위다.

### 실제 VM 1차 적용 결과

사용자가 본인 SSH 터미널의 기존 sudo 인증으로 준비한 `first-phase.sh --apply`를 실행했다.
공유 출력은 host IMDS 양성 대조, 설치/check/probe의 `metadata_guard_passed`, 설치 전후
`web_dns_outbound_passed`, 최종 `p06_b0_first_phase_passed`와 `exit=0`이다.
검증 소스·archive·실행 스크립트는 위 고정 SHA/해시와 같다. 이 결과는 로컬 mock이 아닌
실제 기존 VM/Web에 대한 사용자 실행 증거이며 에이전트가 sudo를 실행한 것으로 기록하지 않는다.

해당 스크립트가 실제로 성공 조건으로 확인한 범위는 다음과 같다.

- root/0700 백업 디렉터리에 변경 전 ruleset·Docker unit/dependency·대상 부재/디렉터리 상태 보존.
  기존 table·flowtable·forward hook과 새 대상 부재 대조 후 승인 범위만 설치.
- host IMDSv2 metadata/cert/key HTTP 200을 body 폐기 방식으로 양성 대조.
- 현재 Web의 v1/v2 여섯 경로 모두 네트워크 실패, 차단 counter 증가, 동일 시점 host 양성 대조.
  HTTP 응답이나 단순 timeout만으로 성공 판정하지 않음.
- 설치 전후 Web DNS·HTTPS outbound 성공, `/healthz`·`/readyz` HTTP 200과 healthy.
  Web ID/시작 시각 및 Docker 활성 진입 시각 유지. 재생성·재시작은 실행하지 않음.

공유 결과 후 에이전트의 SSH 읽기 재확인도 성공했다. guard unit은 loaded/active(exited)/
success, Docker는 active이며 전용 guard Requires와 drop-in이 연결됐다. 새 경로·파일·unit은
root:root이고 쓰기 권한은 root만 가지며, root 백업은 0700이다. 기존 scripts는 일반 사용자
소유/0750을 그대로 유지했다. 기존 Web/PostgreSQL은 healthy, 두 health endpoint도 HTTP 200이다.

**현재 Web 차단의 1차 proof만 완료했다.** 동일 bridge 작은 probe 재생성, 실제 Web 재생성,
Docker 재시작/live-restore, VM reboot 및 이전 Web 복구 후 지속성 검증은 아직 없다.
실제 Instance Principal repo pull·Vault Secret 읽기·신규 CI Run Command는 B0-2 증거로 남는다.
재시작·Console 권한·IAM/Stack Plan/Apply·전체 ARM64 후보 빌드는 이번에 실행하지 않았다.
지속성 proof 전 새 Console Secret grant를 적용하지 않는다.
