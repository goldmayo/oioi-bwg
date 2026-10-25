---
title: "ADR 0003: Console MFA 증명과 회수 경계"
kind: adr
status: accepted
recorded_at: "2026-10-25"
decision_period: "2026-10-10~21"
source_commit: 4a517def6da34ea3c9ad883f8e9146112a032e37
---

# ADR 0003: Console MFA 증명과 회수 경계

이 문서는 완료 작업을 근거로 소급 작성한 결정 기록이다. 작성일을 최초 결정일로 해석하지 않는다.

## 배경

관리 세션에 비밀번호 검증만으로 충분한 권한을 주지 않고, OTP 재사용과 MFA 초기화 뒤의 기존 세션도 거절해야 했다.

## 결정과 대안

비밀번호·ACTIVE·ADMIN·TOTP를 최종 인증에서 함께 검증한다. MFA secret은 암호화하고 step을 원자 소모하며 JWT의 mfaVersion을 DB와 대조한다. 회수는 version 증가와 비공개 재등록으로 처리한다.

기존 Auth.js Credentials를 유지했다. 초기 범위에 recovery-code UI·메일 OTP fallback·분산 limiter·세션별 관리 플랫폼을 추가하지 않았다.

## 결과와 한계

전용 secret·host-only cookie·Origin 검증이 필요하다. limiter는 단일 process 메모리이므로 복제 운영을 지원한다고 주장하지 않는다.

## 근거

- [구현·검증 기록](../migration/implementation/console-guide-editor/P05-D-RESULT.md)
- [관련 기준 또는 이전 결정](../migration/oioi-bwg-architecture-clean-v1/04-auth-authz-architecture.md)
- [통합 커밋](https://github.com/goldmayo/oioi-bwg/commit/9e1e6ba3)
- [시간순 devlog](../devlog/README.md)
