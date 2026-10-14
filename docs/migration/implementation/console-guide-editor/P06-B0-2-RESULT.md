---
title: "P06-B0-2 Console repository와 최소 읽기 권한 구현 결과"
kind: migration-result
status: active
source_commit: 6ac0c387fc7c9cecc5907e5a309f6fdb399c56cb
verified_at: "2026-10-14"
updated_at: "2026-10-14"
revision: 1
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
