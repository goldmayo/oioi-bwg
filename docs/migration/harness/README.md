# Validation harness reference

이 폴더의 자료는 다른 구조화 프로젝트에서 가져온 비교/참고 입력이다. 이 디렉터리 안의
`package.json`, ESLint/Vite/Vitest/Steiger 설정은 현재 애플리케이션에서 직접 실행하지 않는다.

현재 프로젝트에 적용된 하네스의 실행 파일은 repository root에 있다.

- `eslint.config.mts`
- `eslint-rules/architecture.js`
- `steiger.config.ts`
- `.prettierignore`
- `.husky/pre-commit`, `.husky/pre-push`
- `.github/workflows/verify.yml`
- root `package.json`의 `verify`, `lint:fsd`, `format:check`

적용 결과와 원본 대비 차이는
`docs/migration/implementation/M2-VALIDATION-HARNESS-RESULT.md`에 기록한다.
