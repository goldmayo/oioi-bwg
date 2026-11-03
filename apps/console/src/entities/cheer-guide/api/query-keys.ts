/** RSC seed와 브라우저 조회가 공유하는 관리 목록 identity. */
export const cheerGuideQueryKeys = {
  adminList: () => ["cheer-guide", "admin-list"] as const,
  editor: (id: string) => ["cheer-guide", "editor", id] as const,
};
