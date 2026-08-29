# 20. 커밋 훅

> **상태:** ⬜ 미적용 — husky · lint-staged 미설치
> **지금은:** 커밋 전에 **사람이** 순서대로 돌립니다 ([15. 코드 규약](15-conventions.md))

```
npm run typecheck → npm run format → npm run typecheck (재실행)
```

## 자동화가 까다로운 이유

위 순서에서 **`typecheck`를 두 번 돌리는 게 핵심**입니다.
`eslint --fix`가 코드를 바꿔 타입을 깰 수 있기 때문입니다 — 실제로
`columnMeta: {} as ColumnMeta`의 단언을 `no-unnecessary-type-assertion`이 떼어내
`columnDef.meta`의 타입이 통째로 사라진 적이 있습니다.

그런데 **lint-staged의 표준 구성은 이 순서를 표현하지 못합니다.**

```jsonc
"lint-staged": { "*.{ts,tsx}": ["eslint --fix", "prettier --write"] }
```

이건 staged 파일에만 돌고 타입체크는 프로젝트 전체를 봐야 하는데, `tsc`는 파일 단위로
쪼갤 수 없습니다. 그래서 도입한다면 둘 중 하나를 골라야 합니다.

| 방식 | 내용 | 트레이드오프 |
| --- | --- | --- |
| **A. 포맷만 훅으로** | lint-staged는 `eslint --fix` + `prettier --write`만. 타입체크는 CI | 커밋은 빠름. 타입 파손은 CI에서 발견 |
| **B. pre-push에 verify** | 커밋은 가볍게, push 전에 `typecheck → lint → test` 전체 | 느리지만 깨진 걸 밀지 않음 |

**A + B 조합을 권장합니다** — pre-commit은 포맷, pre-push는 verify.
pre-commit에 전체 타입체크를 넣으면 커밋마다 수십 초가 걸려 사람들이 `--no-verify`를 쓰기 시작합니다.

## 설치

```bash
npm i -D husky lint-staged
npx husky init
echo "npx lint-staged" > .husky/pre-commit
echo "npm run verify" > .husky/pre-push      # verify는 21 참고
```

## `.prettierignore`는 이미 있습니다

```
package-lock.json
src/app/routeTree.gen.ts     # 생성물 — TanStack Router가 덮어씀
docs/                        # 참고 문서 — format이 대량 diff를 만듦
```

⚠️ **`src/shared/ui`(shadcn)를 여기 넣지 마세요.** 우리가 소유하고 수정하는 코드라
포맷·린트·리뷰 대상입니다.

## 체크리스트

- [ ] pre-commit = lint-staged (포맷만)
- [ ] pre-push = `npm run verify`
- [ ] 훅이 실제로 도는지 확인 (`--no-verify` 없이 커밋해보기)
