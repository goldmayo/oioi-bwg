---
title: "P06 선택적 이미지 재사용 구현 결과"
kind: migration-result
status: active
source_commit: 18de205ad1b187101922228dfe83678f927238d7
verified_at: "2026-10-17"
---

# P06 선택적 재사용 결과

[P06 계획 개정](P06-PLAN.md#2026-10-17-선택적-재사용-개정)을 최신 main `18de205`에서 시작했다.
#147/#148 MERGED, #149 OPEN(`c19d0a7`)을 GitHub에서 확인했다. 기존 worktree·개인 env·MFA/DB는 보존한다.

첫 concern은 `promotion.mjs`의 릴리스 source와 image build source 분리, canonical pair hash,
성공 배포 receipt의 artifact/PR/tree/run/attempt/기존 verify check 검증, Turbo dry-run과 경로의 보수적 판정이다.
최신 성공 배포 증거가 없으면 오래된 CI/tag로 fallback하지 않는다. 공개 build 입력 hash가 바뀌어도 두 앱을 빌드한다.
후보 producer는 우선 두 이미지를 새 빌드하며 workflow 연결은 후속 concern이다.

후보 계약 concern에서 기본 여섯 검사와 `pnpm test:ops` 142건, `pnpm build` 두 앱이 성공했다.
harness 18건·unit 459건·unit/build 캐시 0이다. 최초 ops 실행은 PATH의 jq 부재로 실패했고,
공식 jq 1.8.2 ARM64 checksum 대조 후 임시 PATH에서 재실행해 성공했다. Turbo 2.11.7의 실제 dry-run을
읽고 dependency placeholder를 변경 앱으로 오인하지 않도록 보정했다. 변경 판정/증거 신규 테스트는 24건이다.
구현 commit과 PR/원격 CI는 PR 본문에서 추적한다. 실제 OCI/VM 배포·Terraform·Secret/DB 변경은 하지 않는다.
현재 WSL의 Docker CLI는 통합 미설정으로 실행 불가다. mock 성공을 실제 컨테이너/OCI 성공으로 간주하지 않는다.
