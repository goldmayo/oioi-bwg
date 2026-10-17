"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import type { ConsoleMfaSetupResponse } from "@oioi-bwg/contracts/console-mfa";
import { z } from "zod";

import { captureClientErrorOnce } from "@/shared/api/capture-client-error";
import { ApiError } from "@/shared/api/http-errors";

import { signIn } from "../api/actions";
import { confirmMfa, setupMfa } from "../api/api";

const subscribeToHydration = () => () => undefined;
// 첫 단계에는 OTP 입력이 없다. 최종 제출에서는 아래 submit이 빈 OTP를 별도로 거절한다.
const loginSchema = z.object({
  email: z.email({ message: "올바른 이메일 형식을 입력해주세요." }),
  password: z.string().min(6, { message: "비밀번호는 최소 6자 이상이어야 합니다." }),
  otp: z
    .string()
    .regex(/^\d{6}$/, "인증 코드 6자리를 입력해주세요.")
    .or(z.literal("")),
});
const empty = { email: "", password: "", otp: "" };
export type ConsoleLoginValues = z.infer<typeof loginSchema>;
// 로그인: credentials → login(OTP) → Auth.js 인증.
// 등록: setup → confirm(QR/version) → complete → credentials에서 별도 로그인.
// QR/version을 confirm 상태에 묶어 등록 정보 없이 확인 단계에 진입하지 못하게 한다.
type LoginStep =
  | { kind: "credentials" | "login" | "setup" | "complete" }
  | { kind: "confirm"; enrollment: ConsoleMfaSetupResponse };

function withRetryMessage(message: string, seconds?: number) {
  return seconds ? `${message} ${seconds}초 후 다시 시도해주세요.` : message;
}

function authenticationErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "UNAUTHENTICATED") return "인증 정보를 확인해주세요.";
    return withRetryMessage(error.message, error.retryAfterSeconds);
  }
  // HTTP 파서의 원본 실패 객체에는 민감 응답이 포함될 수 있어 고정 오류만 보고한다.
  captureClientErrorOnce(new Error("Console authentication request failed"), {
    source: "admin-login-form",
  });
  return "인증 중 오류가 발생했습니다. 다시 시도해주세요.";
}

/** 입력/QR은 이 폼의 메모리만 소유하며 완료·취소·이탈 시 폐기한다. */
export function useConsoleLoginForm() {
  // SSR 폼은 비활성으로 렌더하고, hydration 후에만 민감 입력을 받는다.
  const isHydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const [step, setStep] = useState<LoginStep>({ kind: "credentials" });
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const request = useRef<AbortController | null>(null);
  const form = useForm({ resolver: standardSchemaResolver(loginSchema), defaultValues: empty });

  // 취소·완료·페이지 이탈은 같은 폐기 경로를 사용한다. Query/URL/storage로 옮기지 않는다.
  const reset = useCallback(
    (next: "credentials" | "setup" | "complete" = "credentials") => {
      request.current?.abort();
      request.current = null;
      form.reset(empty);
      setServerError(null);
      setLoading(false);
      setStep({ kind: next });
    },
    [form],
  );

  useEffect(() => {
    // 뒤로 가기 복원 시에도 QR/입력을 남기지 않으며, unmount는 진행 중 HTTP 요청을 취소한다.
    const discard = () => reset();
    window.addEventListener("pagehide", discard);
    if (new URLSearchParams(window.location.search).get("code") === "rate_limited")
      setServerError("요청 횟수를 초과했습니다. 잠시 후 다시 시도해 주세요.");
    return () => {
      window.removeEventListener("pagehide", discard);
      request.current?.abort();
    };
  }, [reset]);

  async function submit(values: ConsoleLoginValues) {
    setServerError(null);
    if (step.kind === "credentials") {
      // '다음'은 입력 검증과 화면 전환만 한다. 비밀번호 검증/세션 발급 요청은 아직 보내지 않는다.
      setStep({ kind: "login" });
      return;
    }
    if (step.kind === "complete") return;
    if (step.kind !== "setup" && !values.otp) {
      form.setError("otp", { message: "인증 코드 6자리를 입력해주세요." }, { shouldFocus: true });
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    try {
      switch (step.kind) {
        case "setup": {
          // 서버가 비밀번호/ACTIVE ADMIN을 확인하고 실제 저장된 pending secret/version의 QR을 반환한다.
          const enrollment = await setupMfa(
            { email: values.email, password: values.password },
            controller.signal,
          );
          if (!controller.signal.aborted) setStep({ kind: "confirm", enrollment });
          break;
        }
        case "confirm": {
          // QR 응답의 version으로 확인한다. OTP를 소모한 뒤 입력/QR을 버리며 세션은 발급하지 않는다.
          await confirmMfa({ ...values, version: step.enrollment.version }, controller.signal);
          if (!controller.signal.aborted) reset("complete");
          break;
        }
        case "login": {
          // 최종 단계에서만 credentials + OTP를 Auth.js로 보낸다. 서버의 원자 소모 후 JWT가 발급된다.
          const data = new FormData();
          for (const [name, value] of Object.entries(values)) data.append(name, value);
          const result = await signIn(data);
          // Action 자체는 AbortSignal로 취소할 수 없으므로, 이탈 뒤의 늦은 결과는 화면에 반영하지 않는다.
          if (controller.signal.aborted) break;
          if (result?.error) {
            setServerError(
              withRetryMessage(
                result.error,
                "retryAfterSeconds" in result ? result.retryAfterSeconds : undefined,
              ),
            );
            form.setValue("otp", "");
          } else if (!result) reset();
          break;
        }
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      setServerError(authenticationErrorMessage(error));
      form.setValue("otp", "");
    } finally {
      // 취소 후 새 요청이 시작됐다면 이전 요청의 finally가 새 loading 상태를 풀지 않도록 한다.
      if (request.current === controller) {
        request.current = null;
        setLoading(false);
      }
    }
  }

  return { form, step, serverError, loading, isHydrated, submit, reset };
}
