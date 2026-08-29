알겠습니다. 이제 **Next.js 16 + App Router만 사용 + FSD 레이어 병행 구조**를 전제로 한 CI 품질 유지 가이드 문서를 정리해드릴게요.  

---

```markdown
# Next.js 16 + App Router + FSD 구조 CI 가이드

> **적용 대상:** Next.js 16 (App Router 기반, `pages/` 미사용)  
> **구조:** `app/` 라우터 + FSD 레이어(`widgets`, `features`, `entities`, `shared`)  
> **도구 패키지:**  
> - **TypeScript** → `typescript`, `@types/node`  
> - **ESLint** → `eslint`, `@typescript-eslint/eslint-plugin`, `eslint-config-next`, `eslint-config-prettier`, `eslint-plugin-boundaries`  
> - **Prettier** → `prettier`  
> - **Vitest** → `vitest`, `@vitest/coverage-v8`  
> - **Husky** → `husky`  
> - **lint-staged** → `lint-staged`  
> - **Steiger** → `steiger` (FSD 레이어 구조 강제)  
> - **GitHub Actions** → CI 워크플로  

---

## 원칙

1. **결정적** — 같은 코드면 언제 돌려도 같은 결과. flaky 테스트 금지.  
2. **외부 세계 무의존** — 네트워크·백엔드 장애가 머지를 막지 않도록 한다.  
3. **로컬과 동일** — CI 실패는 로컬에서 같은 명령으로 재현 가능해야 한다.  
4. **레이어 강제** — App Router는 라우팅만 강제하므로, FSD 레이어 규칙은 steiger + ESLint로 강제한다.  

---

## 검증 스크립트

`package.json`:

```jsonc
"scripts": {
  "verify": "npm run typecheck && npm run lint && npm run lint:fsd && npm test",
  "typecheck": "tsc --noEmit",
  "lint": "eslint .",
  "lint:fsd": "steiger lint",
  "test": "vitest run",
  "check": "prettier --check .",
  "build": "next build"
}
```

- **verify**: 머지 차단 게이트 (typecheck, lint, steiger, test)  
- **lint:fsd**: steiger로 FSD 레이어 구조 검사  
- **check**: prettier 포맷 확인  
- **build**: Next.js 빌드 검증  

---

## GitHub Actions 워크플로

`.github/workflows/verify.yml`:

```yaml
name: Verify

on:
  pull_request:
  push:
    branches: [main, develop]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm install -g npm@11
      - run: npm ci
      - run: npm run verify
      - run: npm run check
      - run: npm run build
```

⚠️ **Branch Protection**에서 `verify`를 required check로 지정해야 실제 머지 차단이 됩니다.

---

## Git Hooks (로컬)

Husky + lint-staged 설치:

```bash
npm i -D husky lint-staged
npx husky init
```

`.husky/pre-commit`:

```bash
npx lint-staged
```

`.husky/pre-push`:

```bash
npm run verify
```

`lint-staged.config.js`:

```js
export default {
  "*.{ts,tsx}": ["eslint --fix", "prettier --write"]
};
```

- **pre-commit**: 빠른 포맷팅만  
- **pre-push**: 전체 verify 실행  

---

## 테스트 전략

- 러너: **Vitest (Node 환경)**  
- 대상: `src/**/*.test.ts` — 순수 함수 및 `-utils/` 로직  
- DOM 테스트 필요 시 `environmentMatchGlobs`로 jsdom 켜기  
- Playwright: e2e는 별도 워크플로로 도입 예정  

---

## 확장 순서

1. ✅ verify + check + build 게이트  
2. ✅ Branch Protection required check  
3. ⬜ Renovate/Dependabot 연결  
4. ⬜ 번들 예산(`npm run size`)  
5. ⬜ 컴포넌트 테스트(jsdom) → coverage 임계치  
6. ⬜ Playwright E2E  

---

## 체크리스트

- [x] `verify` 스크립트 정의  
- [x] CI에서 `npm ci` 사용  
- [x] ESLint + Prettier + Vitest + Steiger 포함  
- [ ] Branch Protection 설정 완료  
- [ ] Renovate/Dependabot 연결  

---

## 결론

Next.js 16 App Router 기반 프로젝트에서 FSD 레이어를 병행하려면  
**라우팅은 Next.js가 강제하고, 레이어 규칙은 steiger가 강제**해야 합니다.  
CI와 Git Hooks를 이중 안전망으로 구성해 코드 품질을 지속적으로 유지하세요.
```

---

이제 이 문서를 `CI-GUIDE.md`로 저장하면 팀 전체가 참고할 수 있습니다.  

👉 원하시면 제가 **steiger 설정 예시**(`steiger.config.ts`)까지 만들어드릴까요?