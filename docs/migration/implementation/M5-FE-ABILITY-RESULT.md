# M5 FE Ability 전달 결과

## 완료 범위

- 서버 CASL action/subject vocabulary와 직렬화 rule contract를 `shared/contracts`에 추가했다.
- `GET /api/auth/ability`가 현재 RequestContext의 rules를 반환한다.
- client는 server-only auth 모듈을 import하지 않고 직렬화된 rules로 ability를 구성한다.
- UI gating 기반만 추가했으며 실제 관리자 UI 적용과 403 self-healing은 후속 checkpoint다.

## 검증

- `pnpm type-check`
- `pnpm test:unit:run`
- `pnpm lint`
- `pnpm lint:fsd`
- `pnpm test:harness`
- `pnpm format:check`
- `pnpm build`

production DB에는 연결하거나 변경하지 않았다.
