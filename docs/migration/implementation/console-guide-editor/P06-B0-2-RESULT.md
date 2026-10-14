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
