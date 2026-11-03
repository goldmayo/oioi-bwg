import eslintPackage from "eslint/package.json" with { type: "json" };
import { builtinRules } from "eslint/use-at-your-own-risk";

if (eslintPackage.version !== "9.39.4") {
  throw new Error(`원본 core rule은 검증한 ESLint 9.39.4가 필요합니다: ${eslintPackage.version}`);
}

export default {
  meta: { name: "core-js" },
  rules: Object.fromEntries(
    ["no-var", "no-restricted-imports", "no-restricted-syntax"].map((name) => {
      const rule = builtinRules.get(name);
      if (!rule) throw new Error(`원본 core rule을 찾을 수 없습니다: ${name}`);
      return [name, rule];
    }),
  ),
};
