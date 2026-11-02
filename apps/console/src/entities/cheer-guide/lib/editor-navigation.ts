/** 공유할 URL에는 실제 진입 화면만 기록하고 비밀·입력 초안은 넣지 않는다. */
export function cheerGuideEditorHref(id: string, returnTo: string) {
  return `/admin/cheer-guides/${encodeURIComponent(id)}/edit?${new URLSearchParams({ returnTo })}`;
}
