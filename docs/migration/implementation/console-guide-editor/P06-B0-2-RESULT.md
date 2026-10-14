---
title: "P06-B0-2 Console repository와 최소 읽기 권한 구현 결과"
kind: migration-result
status: active
source_commit: 6ac0c387fc7c9cecc5907e5a309f6fdb399c56cb
verified_at: "2026-10-14"
updated_at: "2026-10-14"
revision: 3
---

# P06-B0-2 결과

**실제 Stack Plan 검토와 승인된 Apply 성공을 확인했다. 주체별 권한 실증은 아직 미실행이다.**
[B0 계획](P06-B0-PLAN.md)의 선언 변경과 실제 probe를 독립 검증 가능한 PR로 나눈다.
#138 merge head `345315e9377dd3cd7050f2d5afefb5b6fd18eed5`에서 분기했고 위 source_commit이
`infra/oci` 구현 여섯 파일의 검증 ref다. 정확한 전체 SHA와 PR/CI는 PR 본문에서도 대조한다.

private Console repo 한 개·이름 입력/output, Console Auth/MFA의 기존 Secret OCID 두 개 입력,
기존 VM policy의 exact repo·Secret 읽기를 추가했다. 중복/다른 종류/기존 runtime 목록과 겹침,
Web/Console repo 이름 중복을 거절한다. 기존 Web repo 주소, runtime 목록과 Run Command
계정 세 정책·그룹·VM·Vault/Key는 바꾸지 않았다. 게시 계정의 기존 정책 교체는 별도 승인 작업이다.

실행한 검사는 Terraform 1.5.7 `fmt -check`·`init -backend=false`·`validate`, 변수 입력의
정상/중복/다른 종류/개수 부족 진단 검사, AGENTS 기본 여섯 검사와 ops 90건이다. 모두 통과했다.
harness 18건·unit 459건이며 Terraform console의 진단 검사는 OCI API Plan이나 Apply가 아니다.
console은 변수 오류 진단에도 종료 코드 0을 반환할 수 있어 최초 테스트의 종료 코드 가정을
수정하고 실제 오류 진단을 대조했다. Terraform은 공식 배포 archive와 SHA-256 목록을 대조해 사용했다.
앱 runtime/build 파일은 변경하지 않았다. push hook과 GitHub CI 결과는 PR 본문에서 별도 기록한다.

다음 코드 checkpoint는 full ARM64 candidate를 막은 상태에서 같은 CI 게시 계정의 작은
두 repo push, host Instance Principal pull·Console Secret 형식 검사, 같은 API 계정의 신규
Run Command exit 0을 순서대로 확인하는 경로다. 실제 Web/재시작 proof, 승인된 Stack source/input
변경·실제 Plan diff 검토·Apply가 선행 조건이다. 어떤 운영 성공도 이번 IaC 검사로 대신하지 않는다.


## 2026-10-14 실제 Plan 실패와 콘솔 입력 보완

사용자가 같은 Stack 편집을 완료한 뒤 제공한 실제 Plan 로그에서 provider 8.29.0 설치와
기존 리소스 refresh/read가 성공했다. 실패 원문은 `var.console_secret_ocids is empty list of string`와
`Provide two distinct OCI Vault Secret OCIDs for Console Auth and MFA.`다. 콘솔의 목록 필드는
사용 가능한 옵션이 없다는 사용자 관찰과 함께 입력이 비어 전달된 사실을 확인했다.
`1 to add, 0 to change, 0 to destroy`는 오류 전의 불완전한 계획이며 성공한 Plan이 아니다.
Apply는 실행하지 않았다. 이 첨부 로그에는 실제 Job Git SHA가 없어 별도 대조가 남는다.

#139는 Verify `38572266634` 전체 성공 후 사용자 승인으로
`141e8eba5ae811874409a312d4e137950e087f2a`에 병합했다. 입력 보완은 이 최신 merge head에서
`feature/p06b0-stack-input-fields`로 분기했다. 코드 검증 ref는
`d66c0a21d3e7410280706bfaf279bafeafb44416`이다.

목록 입력을 `console_auth_secret_ocid`와 `console_mfa_secret_ocid` 두 필수 문자열로 바꾸고
내부 local에서만 결합했다. 실제 정책 statement와 리소스 주소는 유지했다. OCID 종류·빈값·누락을
거절하고 서로 다른 두 개·기존 runtime Secret과 겹침 방지 조건도 유지한다. Secret 원문을 입력받지
않는다. 콘솔에서 입력하고 Plan/검토/Apply하는 기존 경로를 사용하며 Cloud Shell 우회 준비는
사용자 요청으로 취소·삭제했다. 운영 Stack이나 IAM에 이 코드를 직접 적용하지 않았다.

Terraform 1.5.7의 `fmt -check -diff`, `init -backend=false`, `validate`가 성공했다.
실제 변수 선언·local 결합·precondition을 복사한 로컬 `terraform_data` fixture에서 정상, 빈 Auth,
잘못된 종류, 두 값 중복, 기존 runtime 겹침, MFA 누락의 여섯 Plan 결과를 확인했다. OCI provider를
호출하지 않는 입력 검증이며 실제 OCI Plan 성공을 대신하지 않는다. 정상 결과의 두 ID 순서도 대조했다.
기본 여섯 검사와 ops 90건이 성공했다. harness 18건·unit 459건이며 cache hit 0이다.
commit hook은 대상 코드 확장자가 없어 lint-staged task 0·commitlint 성공이었다.
push hook·GitHub CI는 실행 후 PR 본문에서 별도 기록한다.

수정 소스가 콘솔에 반영된 뒤 실제 두 문자열 입력칸 표시·OCID 전달·Plan 성공·실제 Job SHA/diff를
확인해야 한다. 현재는 코드/로컬 검사 완료이며 콘솔 입력·Apply 성공을 주장하지 않는다.

## 2026-10-14 IaC 병합·probe 코드 검증

IaC PR #139의 head `c0dee97a57690836e2185037c5ee424fe8797a4e`, Verify `38572266634`
attempt 1 전체 성공·mergeable/CLEAN을 확인했다. 사용자 승인으로 squash 병합했고 merge head는
`141e8eba5ae811874409a312d4e137950e087f2a`다. 최종 한글 PR 본문을 squash 본문으로 사용했다.
사용자는 같은 Stack의 branch/input 변경·Plan까지만 승인했다. 로컬 OCI에는 배포 계정용 프로필만
있어 관리자 credential을 추가로 수집하지 않고 OCI 콘솔 절차를 안내했다. 실제 Plan 결과는 대기다.

그 merge head에서 `feature/p06b0-ci-probes`를 분기했다. 검증 코드 ref는
`dac797ed6998e90f1eb78923ef6f075f0afe8ca8`이다. 두 repository의 작은 marker 게시,
보호된 입력·guard 확인 후 host digest pull·CURRENT Secret 형식 검사, host 선행 확인 뒤
같은 CI API 계정의 신규 command 생성/결과 확인을 구현했다. artifact는 안전한 metadata만
담으며 full candidate는 비활성이다. workflow 배치·메모리 검사 보완은 [PLAN 갱신](P06-B0-PLAN.md#2026-10-14-b0-1-완료와-probe-구현-보완)에 기록했다.

직접 기본 여섯 검사와 ops 92건이 성공했다. harness 18건·unit 459건이며 캐시 hit 0이다.
최초 format 검사는 새 README 줄바꿈에서 실패해 Prettier 적용 후 같은 format 검사가 성공했다.
새 ops wrapper 두 건은 Python mock 10건과 source/host gate 정상 1건·거절 5건을 실행한다.
잘못된 대상·command·exit, 게시 실패·digest 불일치, noisy 오류 출력 보호·signing key cleanup,
guard 실패·marker/env 거절·container 부분 생성 실패 cleanup·Secret 형식 실패를 확인했다.
격리 Docker `--network none`에서도 mock 10건이 성공했다. 실제 OCI 권한을 검사한 결과는 아니다.

로컬 Docker에서는 marker만 담은 ARM64 scratch 이미지를 실제 빌드하고 약 2KB 크기·architecture·
예상 env·marker 추출을 확인했다. 임시 container를 시작하지 않고 삭제했다. 최초 검사는 Docker가
추가하는 기본 PATH 때문에 실패해 Dockerfile에 비밀 없는 PATH를 명시하고 정확히 대조하도록 수정했다.
이는 OCI push/pull, Console 실행 또는 full ARM64 앱 후보 빌드가 아니다. commit hook은
lint-staged ESLint/Prettier·commitlint 성공이다. push hook·CI는 PR 본문에서 별도 확인한다.

Stack Apply·게시 정책 교체·GitHub의 새 ID variable 등록·실제 권한 probe는 아직 승인/실행하지
않았다. B0 완료와 B1 시작을 선언하지 않는다. 다음은 실제 Plan SHA/diff 검토와 별도 Apply 승인이다.


## 2026-10-14 실제 Plan/Apply 확인과 workflow 수정

입력 보완 #141은 Verify `38578612070` 전체 성공 후 사용자 승인으로
`801917cf4723fee244481c291e003e5e18503643`에 병합했다. 사용자의 실제 Plan은
private Console repository 생성, runtime policy의 읽기 statement 세 개 추가,
기존 Logging parser의 `time_type = "string"` 추가로 `1 to add, 2 to change, 0 to destroy`였다.
새 두 Secret ID는 비공개 준비 기록의 기존 Console Auth/MFA ID와 일치했다.
Logging 항목은 기존 `ec5180b` 코드에도 있는 선언이며 새 P06 기능으로 추가한 설정이 아니다.

사용자가 표준 `oci resource-manager job get` 조회 결과로 branch `migration_main`과 commit
`801917cf4723fee244481c291e003e5e18503643`을 확인했다. 최초 안내의 응답 경로
`config-source-record`는 잘못됐고, 실제 `data."config-source"`로 정정한 조회에서 확인했다.
정확한 Job OCID는 공개 문서에 기록하지 않는다.

사용자는 Logging을 포함한 위 세 리소스의 Apply를 명시적으로 승인한 뒤 성공을 공유했다.
제공한 실제 Apply 로그의 완료 결과는 `Apply complete! Resources: 1 added, 2 changed, 0 destroyed.`다.
Console repo 생성과 policy·Logging in-place 수정 완료를 각각 확인했다. 실행된 diff도 검토 범위와
일치한다. Secret 원문·VM/DB 생성·앱 배포·migration·키 재생성은 이 실행에 포함되지 않았다.
Apply 로그에는 별도의 Job ID/소스 SHA/저장 Plan 연결 metadata가 없어 해당 연결은 아직 미대조다.
Plan SHA 확인과 실제 Apply 리소스 증거를 구분하며 재계획 표시만으로 저장 Plan 사용을 단정하지 않는다.

별도 probe PR #140의 최초 Verify `38574705384`는 YAML job이 최상위에 놓여 workflow 검증에서
실패했고 테스트 job은 실행되지 않았다. Prettier 구문 검사만으로 GitHub workflow 구조 검증을
대체한 실수였다. `b0-publish`를 기존 `jobs` 아래로 옮기고 최신 #141 merge head를 반영했다.
`actionlint` 1.7.12 공식 배포와 checksum을 대조해 두 변경 workflow의 정적 검사가 성공했다.
이 도구는 ignored 로컬 경로에만 두었고 프로젝트 의존성·운영 설정은 추가하지 않았다.

게시 계정의 기존 광역 정책 교체·GitHub ID variable 등록·실제 작은 push/pull·두 CURRENT Secret
읽기·새 Run Command exit 0은 아직 미실행이다. B0 완료와 전체 ARM64 B1 시작은 보류한다.

수정된 `verify.yml`의 SHA-256은 `a5f5c6fdbb3ef66fb20460cac2a9c1e00e577fdaa9d27f942e311f76f6e8ae34`다.

최신 main 동기화와 workflow 수정 후 기본 여섯 검사·ops 92건을 다시 실행해 모두 성공했다.
실제 GitHub CI는 수정 push 후 확인하며 최초 workflow 검증 실패와 구분한다. 변경 문서 링크와
충돌 marker 부재도 확인했다. push hook의 자동 실행 결과는 PR 본문에 별도로 기록한다.
