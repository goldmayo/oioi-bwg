import fsd from "@feature-sliced/steiger-plugin";
import { defineConfig } from "steiger";

export default defineConfig([
  ...fsd.configs.recommended,
  {
    // shared는 세그먼트 직접 접근을 허용하므로 public API 검사 제외
    files: ["./src/shared/**"],
    rules: { "fsd/public-api": "off" },
  },
  {
    /**
     * 소비자가 widgets/ai-sidebar 하나라 "합치라"고 제안하지만, 이 분리는 설계 문서
     * (docs/plan/2026-08-19 §6-④)가 지정한 배치입니다 — 전송 파이프라인·전사 스토어는
     * 라우터·화면을 모르는 features에 있어야 하고(향후 채팅→화면 이동·차트 생성이 여기 붙습니다),
     * widgets로 합치면 그때 다시 쪼개야 합니다.
     */
    files: ["./src/features/ai-chat/**"],
    rules: { "fsd/insignificant-slice": "off" },
  },
  {
    /**
     * `app/providers`(docs 03이 지정한 provider 조립 위치) 때문에 전역 해제.
     * steiger의 BAD_NAMES_REACT에 "providers"가 포함되어 내용과 무관하게 항상 걸리고,
     * 진단 위치가 디렉터리 경로라서 files 글롭으로 좁힐 수 없습니다.
     * import 방향·public API 강제는 ESLint boundaries가 계속 담당합니다.
     */
    rules: { "fsd/segments-by-purpose": "off" },
  },
]);
