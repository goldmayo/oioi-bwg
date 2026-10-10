---
title: "P05 Console TOTP 인증 설계 초안"
kind: migration-plan
status: draft
authority: plan
source_commit: 8dae0d79125f1f8c8ef24ae4e4cb7a885b584c55
created_at: "2026-10-10"
updated_at: "2026-10-10"
revision: 1
---

# P05 Console TOTP 인증 설계 초안

[전체 설계 §4](DESIGN.md#4-console--auth)와 [ROADMAP P05](ROADMAP.md)를 구체화한다.
기준은 `goldmayo/oioi-bwg`의 PR [#119](https://github.com/goldmayo/oioi-bwg/pull/119)가
병합된 `migration_main`의 `8dae0d79125f1f8c8ef24ae4e4cb7a885b584c55`이며, 관찰일은 2026-10-10이다.
이 문서는 제안과 구현 전 확인 항목을 담은 초안이다. 코드·DB migration·배포는 수행하지 않았다.

상위 기준은 [헌법](../../oioi-bwg-architecture-clean-v1/01-architecture-constitution.md),
[Auth §4.1·§23·§24](../../oioi-bwg-architecture-clean-v1/04-auth-authz-architecture.md),
[API/Error](../../oioi-bwg-architecture-clean-v1/03-api-error-architecture.md),
[Server](../../oioi-bwg-architecture-clean-v1/06-server-data-access-architecture.md),
[Form](../../oioi-bwg-architecture-clean-v1/08-form-state-architecture.md),
[Testing](../../oioi-bwg-architecture-clean-v1/10-testing-architecture.md),
[배포 Runbook](../../oioi-bwg-architecture-clean-v1/12-deployment-migration-runbook.md),
[Domain AUTH-004~006·Account Lifecycle](../../DOMAIN_SPECIFICATION.md)이다.
상위 문서에 없는 회수·등록 정책은 해당 구현 PR에서 Auth/Domain을 먼저 개정한다.

## 1. 확인한 현재 상태

아래는 기준 커밋의 정적 코드 관찰이며, P05 runtime 검증 결과가 아니다.

| 근거                                                                  | 현재 동작                                                                      | P05 변화                                                        |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| `apps/console/src/auth.ts`                                            | Credentials email/password, JWT, `maxAge = 8시간`. jwt callback은 `sub`만 반환 | 최종 authorize에서 TOTP 추가, MFA claims 보존                   |
| `apps/console/src/server/auth/authenticate-console.ts`                | Argon2id 비밀번호와 DB의 ACTIVE ADMIN 확인                                     | 등록 상태·OTP 소모까지 성공해야 identity 반환                   |
| `apps/console/src/server/auth/request-context.ts`                     | 요청별 DB role/status 확인 후 CASL context 생성                                | MFA 증명·현재 version·활성 상태도 확인                          |
| `apps/console/src/features/auth`                                      | RHF 로그인 폼 → route-local Server Action → Auth.js                            | 메모리 안의 ID/PW → TOTP 입력, 제한된 등록 UI                   |
| `apps/console/src/shared/config/console-runtime.ts`                   | 전용 secret/cookie, HTTP loopback만 허용, Secure=false                         | P05에서는 비공개 조건 유지; HTTPS/Secure 전환은 P06             |
| `packages/server/src/db/schema.ts`, `repositories/auth-repository.ts` | Account/PasswordCredential, MFA 테이블 없음                                    | `admin_mfa`와 executor를 받는 전용 repository 추가              |
| `packages/server/src/services`                                        | 가입·로그인 구현, Password/Email 변경 service는 없음                           | MFA reset/회수 추가; 미래 credential 변경 경로의 회수 계약 명시 |

기존 관리 API·RSC·업로드 Action·ability API의 공통 request-context 경로를 점검한다.
직접 `auth()`만 읽고 관리 권한으로 사용하는 경로가 있으면 같은 PR에서 공통 guard로 연결한다.
Web Credentials와 Web 관리 경로는 P06 전까지 유지한다.

## 2. 범위와 완료 조건

- Console 로그인에는 **비밀번호 + ACTIVE ADMIN + 활성 MFA + 유효하고 미사용인 TOTP**가 필요하다.
- 비밀번호만 확인한 첫 화면 단계와 등록 endpoint는 관리 세션·관리 권한을 발급하지 않는다.
- JWT 증명, DB의 MFA version/활성 상태, DB role/status를 관리 요청마다 함께 확인한다.
- 단일 프로세스의 실패 제한, Origin/CSRF 방어, 제한된 최초 등록, 운영 CLI reset을 포함한다.
- 세션 레지스트리, pre-auth/grant DB, recovery code/메일 OTP, idle tracking/step-up은 추가하지 않는다.
- 공개 hostname·두 앱 배포·Web Admin 종료는 P06이다. P05 완료만으로 공개하거나 배포하지 않는다.

## 3. MFA 데이터와 상태 전이 제안

`admin_mfa`는 Account당 최대 한 행이며 HTTP DTO에 persistence row를 노출하지 않는다.

| 필드              | 제안                                                                 |
| ----------------- | -------------------------------------------------------------------- |
| `accountId`       | Account와 동일한 ID 타입, PK/FK. 탈퇴 시 Account tombstone 정책 보존 |
| `encryptedSecret` | 암호화 envelope. reset 후 행을 보존하기 위해 nullable                |
| `enabledAt`       | nullable timestamp. TOTP 확인 완료 시 설정                           |
| `lastUsedStep`    | nullable 정수. 성공한 **실제 검증 step** 저장                        |
| `version`         | 양의 정수, 최초 1, reset/회수 시 증가. 감소·초기화 금지              |

```text
행 없음 또는 reset 상태(secret=null, enabledAt=null)
  → 비밀번호 + ACTIVE ADMIN 확인 → pending(secret 있음, enabledAt=null)
  → 비밀번호 + 최초 TOTP 확인 → enabled(enabledAt 있음, lastUsedStep 있음)
  → CLI reset → version 증가 + secret/enabledAt/lastUsedStep 비우기
  → 제한된 재등록 → 같은 행·증가한 version으로 enabled
```

DB CHECK는 enabled 상태에 secret/lastUsedStep이 반드시 존재하고, 미활성 상태에는
lastUsedStep이 없도록 한다. MFA 행을 삭제해 version을 1로 되돌리는 reset은 금지한다.
동시 setup은 PK와 조건부 쓰기로 같은 pending 행에 수렴한다. 재시도는 비밀번호를 다시 확인하고
기존 pending secret을 재사용한다. 활성 MFA의 secret은 setup으로 교체하지 않는다.
pending 교체가 필요한 경우에도 제한된 CLI reset을 거치며 version을 증가시킨다.

### 암호화와 TOTP 라이브러리

암호화 제안은 Node `crypto`의 AES-256-GCM, 매 암호화마다 무작위 12-byte nonce,
16-byte 인증 tag, format version을 포함한 envelope다. AAD에는 Account ID와 format version을
넣어 다른 계정으로 ciphertext를 옮기는 것을 거절한다. 세션 회수 version은 AAD와 분리한다.
변조·잘못된 key·해독 실패는 접근을 차단하고 안전한 운영 오류로 처리한다.
[Node crypto의 인증된 암호화 문서](https://nodejs.org/docs/latest-v24.x/api/crypto.html#ciphersetaadbuffer-options)를 참고한다.

키는 별도의 `CONSOLE_MFA_ENCRYPTION_KEY`로 제안한다. Base64 해독 결과 32 bytes를 요구하고
`CONSOLE_AUTH_SECRET`/Web `AUTH_SECRET`을 재사용하지 않는다. Console이 runtime에서 읽어
서버 함수에 명시적으로 전달한다. `NEXT_PUBLIC_*`, Web env, image/build artifact에 포함하지 않는다.
키 교체·분실 시 기존 ciphertext를 읽을 수 없으므로 백업/복구와 재등록 영향을 P06에서 확인한다.

TOTP는 otplib, QR은 qrcode를 사용한다. 초기 제안은 SHA-1, 6자리, 30초,
검증 허용 범위 ±30초이며 서버 시간을 기준으로 한다. OTP/step을 클라이언트 시계로 결정하지 않는다.
현재 공식 otplib 문서는 `epochTolerance`, 검증 결과 `timeStep`, `afterTimeStep`을 제공한다.
구현 PR에서 설치 버전과 Node 호환성을 고정하고 실제 타입·동작을 확인한다.
[otplib 검증 옵션](https://otplib.yeojz.dev/api/otplib/type-aliases/OTPVerifyFunctionalOptions.html),
[검증 결과 step](https://otplib.yeojz.dev/api/%40otplib/totp/type-aliases/VerifyResultValid.html)을 기준으로 한다.

## 4. 로그인과 등록 요청 제안

### 일반 로그인

1. RHF가 ID/PW를 보관한다. 첫 단계는 입력만 확인하고 TOTP 입력으로 진행하며 서버 세션을 만들지 않는다.
2. 최종 Credentials 요청에 email/password/OTP를 함께 보낸다.
3. authorize에서 입력 검증 → limiter → 비밀번호 → ACTIVE ADMIN → MFA/TOTP 원자 소모를 수행한다.
4. 성공한 DB version을 포함한 identity만 Auth.js에 반환하고 폼의 비밀번호·OTP를 비운다.
5. 중간 단계 취소·페이지 이탈 시 비밀번호·OTP·등록 QR을 폐기한다. URL/storage/Query cache에 넣지 않는다.

HTTP 입력은 Credentials/Route Handler에서 한 번 Zod 검증하며 OTP는 숫자 6자리 문자열이다.
로그인 실패 메시지는 계정 존재·role·MFA 상태·잘못된 비밀번호/OTP를 구분해 공개하지 않는다.
Auth.js의 CredentialsSignin과 내부 AppError를 앱의 Server Action/HTTP adapter에서 각각 번역한다.

### 최초 등록과 reset 이후 등록

등록 경로는 로그인 화면의 별도 선택으로 제안한다. Console 공개 전 제한된 접근 환경에서만 사용한다.
공개 전환 후에는 등록 endpoint를 서버 설정으로 닫고, reset 시 접근을 다시 제한한 뒤 잠시 연다.
이 설정은 **등록 허용 여부**만 제어하며 password-only 로그인 허용 flag로 사용하지 않는다.

| 제안 경로                    | 매 요청 검증                                                              | 성공 결과                           |
| ---------------------------- | ------------------------------------------------------------------------- | ----------------------------------- |
| `POST /api/auth/mfa/setup`   | Origin, limiter, email/password, ACTIVE ADMIN, 미활성 MFA, 등록 허용 설정 | `{ qrDataUrl, version }`. 세션 없음 |
| `POST /api/auth/mfa/confirm` | 같은 검증 + OTP + pending version 비교                                    | 활성화 완료 응답. 세션 없음         |
| Auth.js 최종 Credentials     | password/ACTIVE ADMIN/enabled MFA/미사용 OTP                              | Console JWT                         |

setup 응답의 QR에는 인증기용 secret이 포함되므로 `Cache-Control: no-store`를 적용하고
외부 QR 서비스·관측 도구·분석 이벤트·persisted cache로 보내지 않는다. QR은 현재 폼에서만 표시한다.
입력 version은 stale pending을 거절하는 비교값이며 인증 증명이 아니다. accountId는 비밀번호 검증 결과에서 얻는다.
confirm도 비밀번호를 다시 확인하고, reset/활성화와 경합하면 조건부 쓰기 실패로 종료한다.

confirm에서 최초 OTP step을 소모한다. 같은 코드를 로그인에 재사용할 수 없으므로
등록 완료 화면에 **다음 코드로 로그인**을 안내하고 비밀번호를 다시 입력하게 한다.
등록 확인과 로그인 identity 발급을 결합하지 않는 이 UX는 구현 전 확인할 제안이다.

## 5. 재사용·동시성·회수

[RFC 6238 §5.2](https://www.rfc-editor.org/rfc/rfc6238.html#section-5.2)는 성공한 OTP의 재사용을 금지한다.
otplib 검증 성공만으로 세션을 만들지 않고 DB 소모 성공까지 요구한다.

- 사용한 `timeStep`이 `lastUsedStep`보다 커야 한다. 현재 step이나 검증 offset을 대신 저장하지 않는다.
- 검증에 사용한 version/활성 상태/secret과 DB 값이 여전히 같은 경우에만 step을 갱신한다.
- 같은 코드를 동시에 제출하면 조건부 UPDATE의 성공 행 수가 한 요청에만 1이 되어야 한다.
- reset이 먼저 commit되면 이전 secret/version으로 검증한 로그인·confirm은 실패한다.
- 로그인이 먼저 commit돼도 뒤의 reset 이후에는 그 JWT로 시작한 새 관리 요청을 거절한다.
- 이미 인가된 실행 중 요청까지 중단하는 규칙은 추가하지 않는다. guard의 조회 시점 이후 회수 경합은 별도 한계다.

Argon2·QR 생성 등 비싼 작업은 DB lock 밖에서 수행한다. 여러 행의 일관성이 필요한 활성화/회수는
service의 짧은 transaction으로 처리하고, 최종 쓰기에서 검증 당시 credential과 현재 ACTIVE ADMIN을 재확인한다.
Account → credential → MFA 순서로 lock을 통일한다. 단일 조건부 mutation에는 불필요한 transaction을 추가하지 않는다.
repository는 executor를 첫 인자로 받고 connection/transaction을 직접 만들지 않는다.
실제 PostgreSQL 경합 테스트로 조건부 쓰기·최초 행 생성·lock 순서를 확정한다.

### JWT와 공통 Console guard

application claims는 `{ sub, mfaVerified: true, mfaVersion }`이다. role/CASL rules는 넣지 않는다.
현재 `session.maxAge = 8시간`과 Auth.js 표준 만료 처리를 유지한다. 별도 절대 만료/idle 정책은 추가하지 않는다.
jwt callback은 초기 서버 identity에서만 MFA claims를 설정하고 후속 callback에서도 보존한다.
클라이언트 `session.update` 입력으로 MFA 증명/version을 승격하거나 교체할 수 없어야 한다.

`apps/console/src/server/auth/request-context.ts`에서 검증한 세션의 sub/proof/version과
DB의 enabledAt/version/ACTIVE ADMIN을 비교한 뒤 기존 RequestContext/CASL을 생성한다.
React.cache는 요청 lifecycle 안에서만 중복 조회를 줄이며 사용자별 context를 process-global cache에 넣지 않는다.
공유 service의 requireUser/requireAdmin은 유지하고 Web RequestContext에 MFA 요구를 섞지 않는다.
P04 password-only JWT와 Web cookie는 관리 context를 얻지 못한다.

증명 누락·만료·version 불일치는 `UNAUTHENTICATED → 401`이며 권한 부족은 기존 `FORBIDDEN → 403`이다.
401 시 기존 재인증 안내/ability cache 갱신/편집 초안 보존을 유지하고 draft를 자동 폐기하지 않는다.
Session 타입 확장과 proof 전달은 Console 앱의 Auth.js adapter가 소유한다.

### Domain 회수 규칙과 연결

MFA reset은 version 증가 후 secret을 지운다. Password/Email 변경 등 **세션 회수만 필요한 경우**에는
version을 증가시키되 활성 secret과 lastUsedStep을 보존한다. 재로그인에는 새 TOTP가 필요하다.
정지·탈퇴·ADMIN 권한 회수에서도 DB 인가를 즉시 차단하고 version을 증가시켜 복귀 후 옛 JWT가 되살아나지 않게 한다.
탈퇴 시 MFA secret은 인증수단으로 제거하며 Account tombstone 정책을 따른다.

기준 코드에는 Password/Email 변경 service가 없다. 이 UI/API를 P05에 새로 만들지 않는다.
운영 변경도 동일한 회수 service와 연결해야 하며, DB 직접 변경으로 version 갱신을 건너뛰는 것은 허용하지 않는다.
Domain AUTH-004~006의 **전체 Session 회수** 요구 중 이 설계가 구현하는 부분은 Console 회수다.
Web 전체 회수의 기존 미구현 범위를 Console version으로 충족했다고 기록하거나 기존 Domain 정책을 약화하지 않는다.

## 6. 실패 제한과 Origin/CSRF

rate-limiter-flexible의 단일 프로세스 메모리 limiter를 로그인/setup/confirm이 공유한다.
초기 제안은 정규화 계정당 5분에 실패 5회, 신뢰한 IP당 5분에 실패 20회다.
Domain의 회원가입 Email OTP 발송 제한과는 별도 정책이며 수치는 구현 전 확정한다.
동시 요청도 한도를 우회하지 못하도록 비싼 검증 전에 시도를 예약하고 실패를 유지한다.
성공은 해당 요청의 예약만 환급하며 계정/IP 전체 실패 counter를 지우지 않는다.
초과 요청은 adapter에서 429/Retry-After로 번역하고 자동 로그인/OTP 재시도를 하지 않는다.
[라이브러리 공식 예제](https://github.com/animir/node-rate-limiter-flexible/wiki/Overall-example)를 참고한다.

IP는 임의의 X-Forwarded-For를 신뢰하지 않는다. P06 Caddy가 외부 입력을 덮어쓰고
직접 Console 접근을 차단하는 proxy 계약과 연결한다. P05에서 신뢰할 수 있는 주소를 얻지 못하면
제한을 생략하지 않고 공통 제한 bucket을 사용한다. 계정 key는 정규화 후 hash하며 로그에 원문을 남기지 않는다.
TTL과 key 수 상한을 확인하고 process 재시작 시 counter가 사라지는 한계를 기록한다.
복수 Console process 운영 전에는 이 단일 프로세스 계약을 재검토한다.

모든 관리 mutation과 setup/confirm은 configured Console Origin을 정확히 검사한다.
외부/형제 Web origin 및 Origin 누락·null을 허용하지 않는다. GET은 상태를 변경하지 않는다.
JSON endpoint는 content-type을 제한하고 CORS로 다른 origin을 허용하지 않는다.
Auth.js HTTP 로그인/로그아웃의 CSRF 검증을 유지한다.
설치된 next-auth의 서버 signIn은 내부에서 skipCSRFCheck를 사용하므로 Server Action에는
Next의 Origin/Host 검사와 configured Console Origin 검사를 함께 적용한다.
[Next 공식 설명](https://nextjs.org/docs/app/guides/data-security#allowed-origins-advanced)을 참고한다.
SameSite cookie만으로 CSRF 완료를 선언하지 않고 실제 Route/Action/로그아웃 우회 요청을 검증한다.

secret·QR URI·OTP·비밀번호·credential hash는 로그/Sentry에 넣지 않는다.
기존 structured logger로 허용된 실패 분류·requestId만 기록하며 원본 AuthError/입력 객체를 전달하지 않는다.

## 7. 운영 reset과 구현 배치

CLI는 accountId를 명시적으로 받아 공유 회수 service를 호출한다. 브라우저 reset API는 만들지 않는다.
순서는 **Console 접근 제한 → version 증가/reset → 기존 세션 거절 확인 → 제한된 재등록 → 재공개**다.
CLI는 secret/OTP를 출력하지 않으며 대상·전후 version·성공 여부만 안전하게 기록한다.
P05 구현/검증은 guarded Docker Compose PostgreSQL에서 수행한다. production 실행은 별도 명시적 승인 범위다.

| 위치                                                 | 책임                                                                                |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `packages/server/src/db`, `repositories`, `services` | schema, executor 기반 MFA persistence, 등록/소모/회수 규칙과 transaction            |
| Console `src/server/auth`, `src/shared/config`       | request/환경 획득, Auth.js 증명 adapter, Console 전용 key/limiter/Origin 설정       |
| `packages/contracts`                                 | 필요한 serializable MFA 요청/응답 Zod 계약만. secret/key/persistence 타입 공개 금지 |
| Console `features/auth`, 등록 route-private UI       | RHF 폼·QR·TOTP 안내. domain HTTP 호출은 기존 FSD 방향 준수                          |
| 로컬/운영 CLI                                        | 명시적 대상과 DB 실행 안전 guard, 공통 reset service 호출                           |

서버 core가 env·Next/HTTP vocabulary를 읽지 않게 key와 필요한 값을 명시적으로 전달한다.
범용 MFA framework·DI container·새 UI package는 만들지 않는다.
runtime key가 없는 build에서도 비공개 화면의 컴파일이 가능하도록 환경 읽기를 runtime boundary에 둔다.

## 8. PR 분할과 검증 게이트

각 단위는 최신 migration_main에서 분기하고 선행 병합 후 진행한다. 파일 20개/400줄 목표를 적용하며
보안 전환을 분리할 수 없으면 결합 이유·리뷰 순서를 PR에 적는다. P05 중간 상태는 공개하지 않는다.

| 순서  | concern                                                | 완료 기준                                                                        |
| ----- | ------------------------------------------------------ | -------------------------------------------------------------------------------- |
| P05-A | Auth/Domain 정책 개정 + additive MFA schema/repository | 회수 정책 명시, migration SQL 검토·guarded local 적용, constraint/동시 생성 검증 |
| P05-B | 암호화·TOTP 원자 소모·등록/회수 core와 CLI             | 변조/replay/reset 경합을 실제 PostgreSQL로 검증. HTTP 등록 경로는 아직 열지 않음 |
| P05-C | Auth.js claims·공통 guard·limiter·Origin/CSRF 연결     | password-only 차단과 모든 관리 entry 보호를 같은 전환에서 확인                   |
| P05-D | 등록 endpoint·로그인/등록 UI·브라우저 통합             | 제한된 등록 → 다음 OTP 로그인 → 기존 관리/편집 완주, 회수 UX/두 앱 격리          |

구현 PR의 기본 검증은 `pnpm type-check`, `pnpm test:harness`, `pnpm lint`, `pnpm lint:fsd`,
`pnpm test:unit:run`, `pnpm format:check`이며 runtime/build 변경에는 `pnpm build`를 추가한다.
root `pnpm verify`로 묶어 실행했다면 실제 실행 내역으로 기록한다.

- Vitest: OTP 형식·시간 경계·허용 범위·암호화 AAD/변조·claims 보존·session.update 주입·실패 제한.
- Docker PostgreSQL: 같은 OTP 동시 요청 중 1건 성공, stale version/secret 거절, setup/confirm/reset 경합,
  version 단조 증가, 회수 후 새 등록에도 이전 JWT 거절. mock 결과만으로 원자성 완료를 선언하지 않는다.
- Playwright/실제 Auth.js: 첫 단계/등록 확인까지 관리 세션 없음, 다음 코드 로그인,
  password-only/미등록/비ADMIN/정지 계정/Web cookie 거절, cross-origin/누락 Origin/CSRF 실패.
- 기존 Admin 통합 fixture는 Console만 실제 TOTP 등록/로그인으로 전환하고 Web password 로그인은 보존한다.
- 편집 중 version/role 회수 → 401 → 초안 보존·재인증 안내를 확인한다. 과거 JWT는 복귀 후에도 거절한다.
- 로그/응답/image에서 비밀번호·OTP·QR/secret·key 유출이 없는지 확인한다.

P05 완료 결과에는 source/PR/실행 명령·결과와 P06 선행 조건을 기록한다.
실제 R2 업로드·HTTPS Secure cookie·proxy IP 전달·제한된 등록 운영 smoke는 P06에 남긴다.

## 9. 구현 전 확정할 항목

1. 등록 confirm 후 다음 코드로 별도 로그인하는 UX, pending 재사용과 서버 등록 허용 설정 이름.
2. otplib/qrcode/limiter 설치 버전, TOTP 허용 범위와 실패 한도, memory key 상한/신뢰 IP 획득 방식.
3. Domain AUTH-006 및 Auth §4.1에 반영할 Console version 회수 규칙과 운영 credential/role 변경 연결.
4. reset 행의 nullable 제약, Account 탈퇴 시 secret 제거, guarded CLI 경로와 키 복구의 P06 인계.

이 초안에서는 정적 근거와 공식 문서를 대조했다. 위 runtime·DB·브라우저 게이트는 아직 실행하지 않았다.
