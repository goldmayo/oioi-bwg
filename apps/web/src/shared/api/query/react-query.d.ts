import "@tanstack/react-query";

export interface AppMutationMeta extends Record<string, unknown> {
  /** 폼처럼 오류를 인라인으로 완전히 처리하는 mutation의 전역 알림을 생략한다. */
  skipGlobalError?: boolean;
  /** 전역 알림에 사용할 use-case 전용 안전한 메시지다. */
  errorMessage?: string;
}

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: AppMutationMeta;
  }
}
