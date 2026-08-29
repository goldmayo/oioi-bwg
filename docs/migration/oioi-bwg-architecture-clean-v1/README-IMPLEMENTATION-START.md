# oioi-bwg 구현 착수 기준

이 디렉터리의 00~12 문서는 현재 migration 구현 기준이다.

## 시작 순서

1. 00 Document Index 확인
2. 12 Migration Runbook의 M0 → M1부터 시작
3. 구현 중 architecture 예외가 실제로 생기면 관련 문서를 먼저 version bump
4. route classification은 07의 적용 부록으로 migration 중 채운다

## 첫 작업

- staging inventory
- Vinext/Vite/Cloudflare runtime dependency 목록화
- Next.js 16 runtime normalization
- M1 DoD 기준으로 build/runtime 확인

## 원칙

문서를 다시 전면 설계하지 않는다.
구현 중 실제 evidence가 생긴 경우에만 해당 문서를 수정한다.
