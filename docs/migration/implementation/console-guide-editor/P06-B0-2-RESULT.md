---
title: "P06-B0-2 Console repository와 최소 읽기 권한 구현 결과"
kind: migration-result
status: active
source_commit: 6ac0c387fc7c9cecc5907e5a309f6fdb399c56cb
verified_at: "2026-10-14"
updated_at: "2026-10-15"
revision: 6
---

# P06-B0-2 결과

**Stack Plan/Apply와 두 repo push/pull·두 CURRENT Secret 형식 검사·신규 command exit 0을 확인했다.**
게시 정책의 최소 권한 교체는 사용자 승인으로 기존 정책에 복원했으며 후속 보류다.
[B0 계획](https://github.com/goldmayo/oioi-bwg/blob/e93ae610169e4ce0e9b7f1a75a9a02cbf179d46f/docs/migration/implementation/console-guide-editor/P06-B0-PLAN.md)의 선언 변경과 실제 probe를 독립 검증 가능한 PR로 나눈다.
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
담으며 full candidate는 비활성이다. workflow 배치·메모리 검사 보완은 [PLAN 갱신](https://github.com/goldmayo/oioi-bwg/blob/e93ae610169e4ce0e9b7f1a75a9a02cbf179d46f/docs/migration/implementation/console-guide-editor/P06-B0-PLAN.md#2026-10-14-b0-1-완료와-probe-구현-보완)에 기록했다.

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

## 2026-10-15 게시 정책·CI 입력 등록과 Promotion 이력 연결

사용자가 기존 게시 정책의 광역 statement를 제공했고, 검토한 Web·Console 각각의
`REPOSITORY_READ`/`REPOSITORY_UPDATE` 두 statement로 교체했다고 확인했다. 기존 광역 허용을
남긴 채 제한 statement를 추가하는 안이 아니다. 실제 권한 결과는 아래 probe와 구분한다.

#140의 최신 head `6566ba32c2a7deab6b000121aec9630b3d59747b`는 Verify `38583267243` 전체
성공 후 사용자 승인으로 `ab02551f2cd2ce2d51969a7fa27b125cabae504c`에 squash 병합했다.
같은 승인 범위에서 `oci-development-image`의 `OCI_COMPUTE_INSTANCE_OCID`와
`OCI_COMPUTE_COMPARTMENT_OCID`를 기존 VM·compartment ID로 등록하고 API 읽기로 일치 대조했다.
새 credential을 만들거나 Secret 값을 읽은 작업이 아니다.

검증용 #142는 기존 `migration_main → migration_develop` 경계로 열었으나 충돌해 CI가 시작되지
않았다. develop `30592191f7bbf168a227a16a000085944c2191fa`의 tree는 이전 승격 원본
`9fd9661e1dafae94a92e600b2c4b57679a9965f8`의 tree와 같고 해당 원본은 최신 main의 조상이었다.
독립적인 develop 파일 변경은 없으며 과거 squash의 조상 관계 때문에 충돌한 경우다.

최신 main에서 분기한 feature branch에 Git ours merge로 develop 이력만 연결한 #143을 준비했다.
파일 diff는 0개, source tree와 develop의 가상 merge tree 모두
`6c30f8a66b68691936ea7496a83b573a1aaac86e`임을 실제 Git 명령으로 대조했다.
Verify `38585791504` 전체 성공 후 사용자가 이 PR 한정 일반 merge와 임시 설정 변경·원복을
승인했다. 저장소 `allow_merge_commit`과 main ruleset의 허용 방식에만 일반 merge를 잠시 추가하고
#143을 `7734be3b308a7627f5ccb46fbb2bfdb09e42a01a`로 병합했다. 즉시 저장소 설정과 ruleset을
원본 squash 전용으로 원복했고 전체 rules·조건·enforcement·bypass 목록까지 원본과 일치 대조했다.
required verify·strict·PR·force-push 금지 규칙은 계속 유지했다. 향후 Promotion squash 방식은 유지한다.

#142의 충돌 해소와 source/가상 merge tree 일치를 재확인했고 Verify `38587311262`가 시작됐다.
두 repo 실제 push/pull·두 CURRENT Secret 형식 검사·새 command는 승인됐으나 아직 미실행이다.
host 도구와 기존 Secret ID 매핑은 VM 사용자 staging에 전달해 SHA-256을 대조했다. 도구 hash는
`adb289a2bd8d327d4c48434b10fa46e1fe2a80b6ac54de9fcffbc82ad139e6bb`이며, 실제 root probe는
게시 artifact 확인 후 수행한다. VM의 기존 Run Command probe 파일도 저장소와 hash가 일치했다.
값·원문 식별자는 공개 문서에 기록하지 않는다. #142 병합·서비스 재시작·앱 배포·전체 ARM64 후보는 보류한다.

## 2026-10-15 실제 smoke·게시 실패와 진단 보완

#142 Verify `38587311262` attempt 1은 Console native·DB readiness를 통과한 뒤
`console-standalone-smoke.mjs`의 Email label 즉시 count가 0이라 실패했다. 같은 앱 소스의 로컬
standalone 이미지에서 새 브라우저 context 30회로 같은 순서를 대조해 4회 재현했다. 네 경우 모두
locator를 기다린 뒤 count 1로 복구됐고 pageerror는 0건이었다. `apps/console`·`packages`의
이전 P06-A 로컬 검증 소스와 현재 source diff가 없음을 대조했다. CI artifact 이미지 자체를
로컬로 다시 내려받아 대조한 검사는 아니며 이 재현을 운영 이미지 검증으로 기록하지 않는다.

실패한 build job과 그 dependent job만 같은 source에서 재실행했다. attempt 2의 build·일반
verify는 성공했고 작은 이미지 게시 job이 시작됐다. Docker login은 성공했으나 게시 Python
단계가 `b0_ci_probe_failed`로 실패해 `b0-proof.json`은 생성되지 않았다. 기존 도구가 subprocess의
양쪽 stream을 모두 capture하면서 실패 단계까지 남기지 않아 현재 로그로는 build·push·digest
중 어디서 실패했는지 구분하지 못한다. 권한 거절이나 Docker 결함으로 원인을 단정하지 않는다.
사용자에게 두 repo의 해당 tag 존재 여부를 조회해 달라고 요청했다. 같은 실패를 맹목 재실행하지 않는다.

보완 코드 ref는 `6f0b3bfd1b69924de5045fad19467513e26dff75`다. Console smoke의 두 label 검사를
기존 `playwright/test`의 `expect(locator).toHaveCount(1)`로 바꿔 렌더링을 기다리며 동일 개수 조건을
검증한다. 기존 standalone 전체 smoke가 20회 연속 성공했고 진단용 로컬 container는 삭제했다.
[Playwright 공식 권고](https://playwright.dev/docs/api/class-locator#locator-count)를 따른다.

게시 도구는 고정된 build·각 repo push/digest 단계만 출력한다. 실패 시 timeout·permission_denied·
command_failed의 한정된 분류만 기록하고 원문 양쪽 stream·credential·Secret은 출력하지 않는다.
출력 보호 fixture에 build timeout·권한 거절·Console push 실패를 추가해 중단 순서·고정 진단과
민감 문자열 비노출을 대조했다. 게시·digest·host 선행·전체 ARM64 차단 계약은 유지한다.

기본 여섯 검사를 모두 통과했고 ops 92건도 성공했다. Python 진단 보완 후 ops 92건을 다시
통과했다. commit hook ESLint/Prettier는 성공했으며 최초 commitlint의 본문 100자 제한 실패는
본문 줄바꿈을 정정해 해소했다. push hook·실제 새 CI 결과는 PR에서 별도로 기록한다.
실제 두 repo 게시·host pull·CURRENT Secret 읽기·신규 command exit 0은 여전히 미완료다.

## 2026-10-15 실제 Web push 거절과 원문 진단

#144는 Verify `38589901644` 전체 성공 후 사용자 승인으로
`106bbf6f63d3edcf4a96abe24b4945a354b092f0`에 병합했다. 이 source의 #142 Verify
`38591227653`에서 일반 verify·앱 이미지·브라우저·Admin 검증은 성공했다. 작은 이미지 build와
Docker login도 성공했지만 첫 Web push가 `permission_denied`로 실패했다. Console push에는
도달하지 않았고 게시 artifact가 없다. 분류만으로 IAM과 credential 중 어느 것이 원인인지 단정하지 않는다.
사용자는 이전 attempt의 tag가 양쪽에 없고 Console repository가 비어 있다고 확인했다.

사용자가 다시 제공한 게시 정책 두 statement는 계획과 일치했다. 관리자 Audit의 지정 구간 조회는
출력 없이 끝났으며 원인 증거를 얻지 못했다. GitHub 조회에서 기존 Environment의 OCIR Secret
두 개 존재·9월 이후 변경 없음·저장소 수준 중복 없음·실제 workflow의 참조를 대조했다.
사용자 화면의 registry/namespace와 ref 허용도 일치했다. Secret 원문은 조회하거나 출력하지 않았다.

사용자 요청에 따라 실패한 Web/Console `docker push`의 양쪽 stream만 CI에 기록하도록 보완했다.
OCI API·Vault·Run Command 원문은 숨긴다. 실제 자식 프로세스의 stdout/stderr가 push 실패에서만
보이는 로컬 검사와 orchestrator fixture 11건이 성공했다. 아직 수정 후 실제 push를 실행하지 않았으며
코드 검증·PR 및 실제 로그 결과는 후속 기록으로 연결한다. IAM·시크릿·운영 앱은 변경하지 않았다.

코드 검증 ref는 `4010d35c98513c5658cb40f0252e12081220e2f8`이다. 기본 여섯 검사와 ops 92건이
성공했다. harness 18건이며 unit 네 task는 모두 기존 성공 캐시를 재사용했다. 최초 lint는 harness와
겹쳐 임시 fixture 삭제의 ENOENT로 실패했고, harness 종료 후 lint부터 순서대로 재실행해 통과했다.
앱 runtime/build 파일은 바꾸지 않았다. 코드 commit hook은 대상 확장자가 없어 lint-staged task 0과
commitlint 성공이었다. push hook·GitHub CI·실제 게시 결과는 PR에서 별도로 확인한다.

## 2026-10-15 정책 복원과 B0 실제 권한 실증 통과

#145는 Verify `38596373441` 전체 성공 후 사용자 승인으로
`439f824ee060321130e499cb07cfdd8724d96d6c`에 squash 병합했다. 이것이 최종 probe source다.
해당 source와 #142 가상 merge tree는 `7dd939baccd1513356bc2efb8f452991cee32033`으로 같았다.
Verify `38597712962` attempt 1은 일반 verify·이미지·브라우저·Admin 검증 성공 뒤 첫 Web push에서
`denied: User UserId(<비공개 사용자 OCID>) not authorized`로 실패했다. 실제 OCID는 기존 비공개
게시 계정 기록과 일치했다. 코드나 시크릿 교체를 원인 해결로 주장하지 않는다.

사용자는 기존 조건 없는 compartment 범위 `manage repos` 한 줄로 복원하는 안과 최소 권한 조정의
후속 분리를 승인하고, OCI 콘솔 저장 완료를 확인했다. 관리자 API로 정책 저장 상태를 재조회한
것은 아니다. 같은 source·시크릿에서 실패한 게시 job만 재실행했다. attempt 2의
[게시 job](https://github.com/goldmayo/oioi-bwg/actions/runs/38597712962/job/115978635176)은
Web·Console push/digest와 artifact 업로드 모두 성공했다. Admin job은 이전 성공 시각 그대로여서
다시 실행되지 않았다. 정책 축소와 실패의 비교 근거이며 어느 조건이 원인인지는 미분리다.

artifact `b0-publish-439f824ee060321130e499cb07cfdd8724d96d6c-2`의 source/run/attempt·두 repo
digest를 내려받아 대조했다. 동일 ARM64 marker 이미지의 공통 digest는
`sha256:4268a065acecbb5c1aac3ad3a543099369a0b4fdb6f3b1bd8fba91468214332b`다.
host 도구·게시 증거·기존 Console ID 매핑을 전달하고 로컬/VM hash를 대조했다. 사용자가 root/0700
경로에 root/0600으로 복사한 세 파일의 hash를 다시 확인한 뒤 검증 도구를 실행했다.
도구 hash는 `adb289a2bd8d327d4c48434b10fa46e1fe2a80b6ac54de9fcffbc82ad139e6bb`다.

사용자 결과는 `b0_host_probe_passed`, Auth version 1·MFA version 1, exit 0이었다.
이는 실제 guard/Web probe·Instance Principal의 두 digest pull·ARM64/env/marker 대조·시작하지
않은 임시 container 삭제·두 CURRENT Secret의 메모리 내 형식 검사 성공이다. 값·변환 값·Secret
hash는 출력하지 않았다. 이후 SSH 읽기에서 Web/PostgreSQL healthy와 임시 probe 잔존 없음도 확인했다.

그 후에만 같은 source의 host attestation과 신규 명령 실행 label을 #142에 붙였다.
[신규 command workflow](https://github.com/goldmayo/oioi-bwg/actions/runs/38601706992)의
job `115982310366`은 source·게시·host gate와 새 command 생성/실행/결과 확인을 성공했다.
artifact `b0-command-439f824ee060321130e499cb07cfdd8724d96d6c-38601706992-1`을 내려받아
source·새 display name `p06-b0-38601706992-1`·생성 시각·`SUCCEEDED`/정수 exit 0을 대조했다.
생성 시각은 한국 시간 2026-10-15 01:52:52다. 기존 marker나 과거 command 결과를 재사용하지 않았다.
기존 배포 계정의 별도 OCI 읽기 조회에서도 새 ID·대상 VM/compartment·명령 본문·execution ID
연결·생성 시각·exit 0을 대조했다. 원문 OCID는 비공개 운영 기록에만 둔다.

**B0 실제 권한 실증은 통과했다. 게시 최소 권한 조정은 승인된 보류이며 완료가 아니다.**
Stack Apply Job 자체의 source/저장 Plan 연결 metadata 미대조도 앞선 한계로 유지한다.
#142 전체 run의 실패 표시는 의도된 promotion 차단이며 게시 job 성공과 구분한다. #142는 병합하지
않았다. 실제 배포·DB migration·서비스 재시작·전체 ARM64 앱 후보는 이번 실증에 포함되지 않았다.
다음은 B1 두 이미지 candidate 계약이며 B1+B2/host 준비 전 실제 Promotion은 금지한다.
