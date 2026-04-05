import * as Sentry from "@sentry/nextjs";

import { debounce } from "./utils";

const IS_PROD = ["production", "staging"].includes(
  process.env.NEXT_PUBLIC_APP_ENV || "",
);

/**
 * 에러 추적 시스템 (Sentry) 추상화 유틸리티
 * 최종 완성형: 에러 ID 반환, 컨텍스트 격리, 서버리스 전송 보장 포함
 */
export const logger = {
  /**
   * 예외 상황을 캡처하여 Sentry로 전송하고, 에러 ID를 반환합니다.
   * @returns Sentry 이벤트 ID (사용자 문의 대응용)
   */
  error: (error: unknown, context?: Record<string, unknown>): string | null => {
    // 1. 개발 환경에서는 상세 정보를 콘솔에만 출력
    if (!IS_PROD) {
      console.error("[Sentry Dev Error]:", error, context);
      return null;
    }

    // 2. 에러 객체 정규화
    const errorObject = error instanceof Error ? error : new Error(String(error));
    let eventId: string | null = null;

    // 3. withScope를 사용하여 컨텍스트 격리 및 에러 전송
    Sentry.withScope((scope) => {
      if (context) {
        scope.setExtras(context);
      }
      eventId = Sentry.captureException(errorObject);
    });

    return eventId;
  },

  /**
   * 경고 메시지를 전송합니다.
   */
  warn: debounce((message: string, context?: Record<string, unknown>) => {
    if (!IS_PROD) {
      console.warn(`[Sentry Dev Warn]: ${message}`, context);
      return;
    }

    Sentry.withScope((scope) => {
      if (context) {
        scope.setExtras(context);
      }
      Sentry.captureMessage(message, "warning");
    });
  }, 1000),

  /**
   * 일반적인 정보 메시지를 전송합니다.
   */
  info: debounce((message: string) => {
    if (!IS_PROD) {
      console.info(`[Sentry Dev Info]: ${message}`);
      return;
    }
    Sentry.captureMessage(message, "info");
  }, 1000),

  /**
   * 현재 사용자의 정보를 Sentry 컨텍스트에 설정합니다.
   */
  setUser: (id: string, email?: string) => {
    if (!IS_PROD) return;
    Sentry.setUser({ id, email });
  },

  /**
   * 분석용 사용자 정의 태그를 설정합니다.
   */
  setTag: (key: string, value: string) => {
    if (!IS_PROD) return;
    Sentry.setTag(key, value);
  },

  /**
   * 사용자 작업 흐름(Breadcrumbs)을 기록합니다.
   */
  addBreadcrumb: (message: string, category?: string, data?: Record<string, unknown>) => {
    if (!IS_PROD) {
      console.log(`[Breadcrumb]: ${message}`, { category, data });
    }
    Sentry.addBreadcrumb({
      message,
      category,
      data,
      level: "info",
    });
  },

  /**
   * 서버리스 환경에서 이벤트 전송을 보장하기 위해 버퍼를 비웁니다.
   */
  flush: async (timeout = 2000) => {
    if (!IS_PROD) return true;
    return await Sentry.flush(timeout);
  },
};
