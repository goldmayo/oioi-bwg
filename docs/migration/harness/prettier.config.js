//  @ts-check

/** @type {import('prettier').Config} */
const config = {
  semi: true,
  singleQuote: false,
  trailingComma: "all",
  printWidth: 120,
  tabWidth: 2,
  arrowParens: "always",
  endOfLine: "auto",

  // 클래스 순서를 항상 같게 만들어 긴 className을 패턴으로 읽게 합니다 (마지막 플러그인이어야 함)
  plugins: ["prettier-plugin-tailwindcss"],
  /** Tailwind 3.4는 config가 설정 원본 (v4 시절의 tailwindStylesheet를 두면 플러그인이 v4 로더를 타다 죽습니다) */
  tailwindConfig: "./tailwind.config.ts",
  /** 문자열 인자를 클래스로 취급할 함수 — 정렬에서 빠지면 `cn()` 안이 무정렬로 남습니다 */
  tailwindFunctions: ["cn", "cva"],
};

export default config;
