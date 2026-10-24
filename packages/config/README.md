# 공통 tooling 설정

`@oioi-bwg/config`는 저장소 내부 전용 private workspace다. consumer는 `workspace:*` 개발 의존성을
선언하고 `package.json`의 명시적 subpath를 사용한다. 앱 `src`와 공용 서버·계약 runtime에서는
이 package를 import하지 않는다. 앱별 env 해석과 Next/ESLint/Vitest 자동 탐색 entry는 consumer가 소유한다.

| entry                                      | 책임                                                                        |
| ------------------------------------------ | --------------------------------------------------------------------------- |
| `next`, `sentry-build`                     | 앱이 검증한 입력을 사용하는 공통 build factory                              |
| `eslint/*`, `steiger`                      | 공통 규칙·FSD 검사. 실행 root는 consumer가 전달                             |
| `vitest/browser`, `vitest/postgres`        | 공통 테스트 설정. 앱 alias/include·DB 실행 root는 consumer가 소유           |
| `vitest/client-only`, `vitest/server-only` | Vitest 전용 marker mock의 파일 경로                                         |
| `dependencies`                             | source·config·test의 workspace 경계 정책. root runner가 각 TS 설정으로 해석 |
| `typescript/*.json`                        | 공통 TS preset. include·프로그램 소속은 consumer가 소유                     |

Node 22.16의 Vitest config loader는 외부 `.ts` entry를 직접 실행하지 못하므로 두 Vitest factory는
ESM JavaScript와 JSDoc `@satisfies`를 사용한다. package의 `checkJs`·strict 타입 검사를 유지한다.
다른 TS entry는 각 Next·ESLint·Steiger·tsx loader에서 검증한다. 별도 빌드 산출물이나 전역 loader
주입은 필요하지 않다. marker mock과 browser setup은 package 내부에 있으며 root tests를 참조하지 않는다.

`pnpm --filter @oioi-bwg/config type-check`와 `lint`가 자체 검사를 수행한다. 두 앱의 실제 설정과
cwd·loader·Turbo 영향·runtime import 경계는 repository-tools의 architecture harness와 앱 build가 검증한다. Root 명령은 해당 검증을 위임한다.
배포·Sentry 업로드·외부 알림은 이 package의 책임이 아니다.
