/**
 * 세그먼트 배치 규약을 강제합니다.
 *
 * 두 체계가 **다른 근거로** 서 있어서 사람이 헷갈리던 자리입니다:
 *
 * - FSD 슬라이스(`widgets`·`features`·`entities`)는 **목적**으로 세그먼트를 나눕니다.
 *   `hooks/`·`utils/`처럼 "이게 무엇인가"로 묶은 이름은 파일이 늘수록 정보를 잃어서 FSD가
 *   금지합니다. 훅은 그 훅이 다루는 것에 따라 `model`(상태·규칙)이나 `lib`(보조)로 갑니다.
 * - `app/routes/*`의 `-` 폴더는 FSD 슬라이스가 아니라 **콜로케이션**입니다(가이드 02).
 *   한 화면 전용이라 개수가 작고, 거기서는 `-hooks`·`-utils`가 그대로 읽힙니다.
 *
 * steiger의 `fsd/segments-by-purpose`는 `app/providers` 때문에 전역 해제되어 있어
 * (`steiger.config.ts` 주석) 이 검사가 그 빈자리를 메웁니다.
 */

/** FSD가 금지하는 "본질로 묶은" 세그먼트 이름 */
const BANNED_SEGMENTS = new Set(["hooks", "utils", "helpers", "types", "constants", "components", "modals"]);

/** 슬라이스를 갖는 레이어 — `app`은 조립, `shared`는 슬라이스 없이 세그먼트를 직접 가집니다 */
const SLICED_LAYERS = new Set(["widgets", "features", "entities"]);

/** 훅이 있어도 되는 FSD 세그먼트 */
const HOOK_SEGMENTS = new Set(["model", "lib"]);

/**
 * 라우트 콜로케이션 폴더 (가이드 02-fsd).
 *
 * `-api`는 원칙 총람 §4의 "화면 전용은 라우트 `-api/`, 2화면 이상 쓰면 entities 승격"에서 옵니다 —
 * 02-fsd의 목록에는 빠져 있었는데 두 문서를 맞췄습니다(2026-08-25).
 */
const COLOCATION = new Set(["-ui", "-hooks", "-utils", "-model", "-api"]);

const isHookFile = (/** @type {string} */ name) => /^use-[a-z0-9-]+\.tsx?$/.test(name);

/** @type {import("eslint").Rule.RuleModule} */
export const segmentPlacement = {
  meta: {
    type: "problem",
    docs: { description: "FSD 세그먼트와 라우트 콜로케이션 배치를 강제합니다" },
    schema: [],
    messages: {
      bannedSegment:
        "FSD는 '{{segment}}' 처럼 본질로 묶은 세그먼트를 금지합니다 — 목적으로 나누세요. 훅·상태·규칙은 model/, 보조 코드는 lib/ 입니다.",
      hookSegment:
        "훅은 model/ 이나 lib/ 에 둡니다 — 지금은 '{{segment}}/' 입니다. (FSD 슬라이스에는 hooks 세그먼트가 없습니다)",
      unknownColocation:
        "라우트 콜로케이션 폴더는 -ui · -hooks · -utils · -model · -api 다섯뿐입니다 — 지금은 '{{folder}}' 입니다 (가이드 02-fsd).",
      hookOutsideHooks:
        "화면 로직(use-*)은 '-hooks/' 에 둡니다 — 지금은 {{where}} 입니다. 순수 함수는 -utils/, 스텁·화면 전용 타입은 -model/ 입니다.",
    },
  },

  create(context) {
    const path = context.filename.replaceAll("\\", "/");
    const index = path.lastIndexOf("/src/");
    if (index === -1) return {};

    const parts = path.slice(index + "/src/".length).split("/");
    const fileName = parts.at(-1) ?? "";

    /** @type {(messageId: string, data: Record<string, string>) => void} */
    const report = (messageId, data) => {
      context.report({ loc: { line: 1, column: 0 }, messageId, data });
    };

    return {
      Program() {
        const [layer, slice, segment] = parts;

        // ① FSD 슬라이스 — 세그먼트 이름과 훅 위치
        if (layer !== undefined && SLICED_LAYERS.has(layer) && slice !== undefined && segment !== undefined) {
          // 슬라이스 바로 아래 파일(index.ts 등)은 세그먼트가 아닙니다
          if (parts.length > 3) {
            if (BANNED_SEGMENTS.has(segment)) return report("bannedSegment", { segment });
            if (isHookFile(fileName) && !HOOK_SEGMENTS.has(segment)) return report("hookSegment", { segment });
          }
          return;
        }

        // ② 라우트 콜로케이션 — 폴더 이름과 훅 위치
        if (layer === "app" && parts[1] === "routes") {
          const folder = parts.slice(2, -1).findLast((part) => part.startsWith("-"));
          if (folder !== undefined && !COLOCATION.has(folder)) return report("unknownColocation", { folder });
          if (isHookFile(fileName) && folder !== "-hooks") {
            return report("hookOutsideHooks", {
              where: folder === undefined ? "라우트 폴더 바로 아래" : `'${folder}/'`,
            });
          }
        }
      },
    };
  },
};
