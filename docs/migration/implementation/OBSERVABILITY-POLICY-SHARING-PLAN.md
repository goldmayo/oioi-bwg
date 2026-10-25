---
title: "순수 관측 정책 공통화 경계와 전환 계획"
kind: migration-plan
status: proposed
source_commit: fc3167df8bbf7b5e392f3c38c731af3f910463e3
created_at: "2026-10-23"
revision: 1
---

# 순수 관측 정책 공통화 경계와 전환 계획

> 2026-10-26 정리: FWA-04는 설계 완료·runtime 미구현 제안이다. 아래 #199 보류 문구는 10월 23일의 이력이며 P06 F는 이후 종료됐다. 현재 상태·다음 행동은 [WORK](../../WORK.md)를 따른다.

## 근거와 적용 범위

[감사 FWA-04](FRAMEWORK-STRUCTURE-AUDIT.md)의 설계 산출물이며
[후속 계획 단위 C](https://github.com/goldmayo/oioi-bwg/blob/e93ae610169e4ce0e9b7f1a75a9a02cbf179d46f/docs/migration/implementation/FRAMEWORK-IMPROVEMENT-PLAN.md)를 구체화한다.
기준은 #220 squash인 위 source_commit이다. 감사 당시부터 두 앱의 safe-server-event와
client-sentry-policy 네 파일이 불변임을 git diff로 확인해 기존 751줄 중복 근거를 재사용했다.
현재 기능 불일치를 발견한 것은 아니며 공통화 코드는 아직 구현하지 않았다.

[헌법 §5·11](../oioi-bwg-architecture-clean-v1/01-architecture-constitution.md),
[Error UX §12·14·15](../oioi-bwg-architecture-clean-v1/09-error-ux-observability.md),
[기존 관측 결과](OBSERVABILITY-ERROR-TRACKING-RESULT.md)를 따른다.
이 제안은 active architecture의 package 예외를 새로 허용하는 규범 문서가 아니다.

## 소유권

| 대상                                                 | 권고 위치와 이유                                                                          |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| toSafeSentryBuildPath / toSafeSentryBuildMetadata    | 공통 순수 모듈. release·Debug ID·산출물 경로의 같은 정제 규칙                             |
| toSafeRequestId / toSafeEventId                      | 공통 순수 모듈 후보. UUID v4·event ID 형식/정규화 규칙                                    |
| getSafeBuildRelease, APP_ENV 읽기                    | 앱. env/globalThis 및 Next build 입력 해석 경계                                           |
| route template·operation allowlist, 요청 header 처리 | 앱. Web 공개 route와 Console 인증/관리 route는 다른 정책                                  |
| AppError·Drizzle 분류, 서버 request context          | 앱 server adapter. persistence/framework 의존성을 browser로 보내지 않음                   |
| WeakMap correlation·capture 중복 억제                | 앱 lifecycle. 순수 정제와 상태/관측 수명을 분리                                           |
| Sentry init/beforeSend 연결, SDK capture/Dedupe      | 앱. 현재 SDK API와 최초 관측·중복 억제 계약 유지                                          |
| 최종 client/server serializer                        | 우선 앱 유지. 순수 leaf를 추출하고, 전체 이동은 adapter 입력·출력 동등성을 확인한 후 검토 |

Sentry의 sendDefaultPii=false는 프로젝트의 원문 비노출·allowlist를 대체하지 않는다.
기존 라이브러리 API를 숨기는 capture framework, lifecycle/registry, 설정 DSL이나 새 전송 sink는 만들지 않는다.

## Package 권고

실제 두 앱이 소비하는 순수 정책을 private `packages/observability`에 두는 안을 권고한다.
`packages/config`는 tooling 전용, contracts는 HTTP schema/DTO 전용이며 server는 browser가 import할 수
없다. 두 앱 사이 직접 import도 금지되어 있어 기존 package에 편의상 넣으면 경계를 위반한다.

- 최초 public export는 실제 이관되는 `@oioi-bwg/observability/build-metadata`만 둔다.
  correlation export는 실제 consumer 이관 시 추가한다. root barrel이나 미사용 확장점을 선생성하지 않는다.
- runtime은 입력을 새 정제 결과로 투영하는 함수만 둔다. React/Next·Node builtin·DB/Drizzle·SDK 실행,
  env/global 상태 읽기·I/O·전역 mutable cache를 import하거나 소유하지 않는다.
- SDK Event 전체 타입을 별도로 재정의하지 않는다. 작은 정제 결과는 구조적으로 SDK ErrorEvent와
  호환됨을 앱 타입 검사로 보장하며, 불필요한 SDK runtime dependency를 추가하지 않는다.
- 앱의 기존 helper 경로를 명시적 re-export/얇은 adapter로 보존해 실제 consumer를 함께 전환한다.
  release 읽기·request header/WeakMap과 app 태그는 앱에 남긴다.
- 구현 전 같은 변경 단위에서 헌법 §5의 runtime package 예외와 필요한 import 경계를 명시한다.
  이 설계 PR은 architecture·package·lockfile·runtime을 변경하지 않는다. UI-03과도 별개다.

## 다음 구현 단위와 완료 조건

### 1. 불변 build metadata 정제의 공통 소유권

공통 module·명시적 export·두 앱의 실제 consumer·기존 경로 adapter·architecture/harness·설치/빌드
입력을 한 PR에서 완성한다. package만 생성하고 consumer가 없는 준비 PR은 만들지 않는다.
getSafeBuildRelease의 환경 읽기는 유지한다. request ID/전체 serializer는 이 단위의 필수 의존성이
확인된 경우에만 묶으며 관측 분류/전송 정책을 변경하지 않는다.

함께 대조할 연결 지점:

- 두 앱 package.json의 runtime dependency와 pnpm lock importer, source package의 strict 검사.
- [공통 Next 설정](../../../packages/config/next.ts)의 transpilePackages와 Turbo dependency/cache 영향.
- [Web Dockerfile](../../../apps/web/Dockerfile)·[Console Dockerfile](../../../apps/console/Dockerfile)의
  deps stage 명시적 manifest COPY. workspace 추가를 builder COPY만으로 해결했다고 가정하지 않는다.
- [이미지 영향 판정](../../../ops/oci/release-baseline.mjs)의 Turbo graph. 공통 소스 변경이 두 앱 image에
  모두 전파되며 Worker가 자동 consumer가 되지 않는지 확인한다.

완료 조건은 기존 release/path/debug_meta fixture의 **양 앱 이전/이후 출력 동등성**, 유효한 source-map
상관관계 보존, 비허용 URL query/fragment·경로·release·Debug ID 제거와 128개 image 상한이다.
입력 변형 없이 같은 정제 결과를 만들고 throwing getter는 기존 guard 계약 범위에서 검사한다.
순수 package는 Node·Next·server import를 거절하며 실제 client/SSR 번들과 두 앱 standalone build를 검증한다.
필수 로컬 gate·최종 head CI/리뷰·squash와 병합 tree 일치까지가 완료다. 실제 Sentry 전송은 필요하지 않다.

### 2. 나머지 정제 규칙의 점진적 이관

request/event ID 형식, browser exception/frame redaction, server event projection은 각각 실제 consumer와
같은 출력 계약을 완성하는 단위로 검토한다. app별 route/분류를 공통 module에 역으로 import하지 않는다.
전체 serializer를 옮기려면 app 태그·route allowlist·실패 분류의 입력 경계를 먼저 확정하고 기존 개인정보
비노출 fixture·최초 관측/중복 처리·SDK 보강 후 beforeSend 결과가 같은지 검증한다.
751줄 전체를 한 번에 삭제하는 것을 완료 조건으로 삼지 않는다.

PR 목표 20파일/400줄을 넘으면 독립적인 정제 계약으로 나눌 수 있는지 먼저 검토한다. manifest·두 앱
consumer·경계 검사가 함께 필요해 분리할 수 없다면 결합 이유와 리뷰 순서를 본문에 남긴다.
앞 단위 병합 후 최신 migration_main에서 다음 단위를 시작하고 후속 구현을 미리 쌓지 않는다.

## 보류

이번 산출물은 설계다. 구현 착수 시 최신 source와 active 문서를 다시 대조한다.
#199 F/www·운영/Worker 배포·실제 외부 전송·메일/계정 재활성화·UI-03은 계속 보류한다.
