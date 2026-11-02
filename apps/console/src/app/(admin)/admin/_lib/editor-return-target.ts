import { adminLinks, adminPaths } from "@/shared/config/admin-routes";
import { safeReturnPath } from "@/shared/lib/safe-return-path";

/** 복귀 입력을 검증한 뒤 목적지 정의에서 문구를 선택한다. */
export function getEditorReturnTarget(
  input: string | string[] | undefined,
  songId: string,
  fallback: "song" | "guideList",
) {
  const targets = {
    song: { href: adminLinks.song(songId), label: "곡 정보로 돌아가기" },
    guideList: { href: adminPaths.guideList, label: "응원법 목록으로 돌아가기" },
  };
  const choices = Object.values(targets);
  const href = safeReturnPath(
    input,
    targets[fallback].href,
    choices.map((target) => target.href),
  );
  const pathname = href.split(/[?#]/, 1)[0];
  const target = choices.find((choice) => choice.href === pathname) ?? targets[fallback];
  return { ...target, href };
}
