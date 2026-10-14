---
title: "P06-B0-2 Console repository와 최소 읽기 권한 구현 결과"
kind: migration-result
status: active
source_commit: 6ac0c387fc7c9cecc5907e5a309f6fdb399c56cb
verified_at: "2026-10-14"
updated_at: "2026-10-14"
revision: 2
---

# P06-B0-2 결과

**IaC 구현·로컬 검사 완료, 실제 Stack Plan/Apply·주체별 권한 실증은 미실행이다.**
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
