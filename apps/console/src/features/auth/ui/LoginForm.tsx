"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import type { ConsoleMfaSetupResponse } from "@oioi-bwg/contracts/console-mfa";
import Image from "next/image";
import Link from "next/link";
import { z } from "zod";

import { captureClientErrorOnce } from "@/shared/api/capture-client-error";
import { ApiError } from "@/shared/api/http-errors";
import { Button } from "@/shared/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { Input } from "@/shared/ui/input";

import { signIn } from "../api/actions";
import { confirmMfa, setupMfa } from "../api/api";

const subscribeToHydration = () => () => undefined;
const loginSchema = z.object({
  email: z.email({ message: "올바른 이메일 형식을 입력해주세요." }),
  password: z.string().min(6, { message: "비밀번호는 최소 6자 이상이어야 합니다." }),
  otp: z
    .string()
    .regex(/^\d{6}$/, "인증 코드 6자리를 입력해주세요.")
    .or(z.literal("")),
});
const empty = { email: "", password: "", otp: "" };
type Step = "credentials" | "login" | "setup" | "confirm" | "complete";

export default function LoginForm({ enrollmentEnabled = false }: { enrollmentEnabled?: boolean }) {
  const isHydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const [step, setStep] = useState<Step>("credentials");
  const [pending, setPending] = useState<ConsoleMfaSetupResponse | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const request = useRef<AbortController | null>(null);
  const form = useForm({ resolver: standardSchemaResolver(loginSchema), defaultValues: empty });

  const reset = useCallback(
    (next: Step = "credentials") => {
      request.current?.abort();
      request.current = null;
      form.reset(empty);
      setPending(null);
      setServerError(null);
      setLoading(false);
      setStep(next);
    },
    [form],
  );
  useEffect(() => {
    const discard = () => reset();
    window.addEventListener("pagehide", discard);
    if (new URLSearchParams(window.location.search).get("code") === "rate_limited")
      setServerError("요청 횟수를 초과했습니다. 잠시 후 다시 시도해 주세요.");
    return () => {
      window.removeEventListener("pagehide", discard);
      request.current?.abort();
    };
  }, [reset]);

  async function onSubmit(values: z.infer<typeof loginSchema>) {
    setServerError(null);
    if (step === "credentials") {
      setStep("login");
      return;
    }
    if (step !== "setup" && !values.otp) {
      form.setError("otp", { message: "인증 코드 6자리를 입력해주세요." }, { shouldFocus: true });
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    try {
      if (step === "setup") {
        const result = await setupMfa(
          { email: values.email, password: values.password },
          controller.signal,
        );
        if (!controller.signal.aborted) {
          setPending(result);
          setStep("confirm");
        }
      } else if (step === "confirm" && pending) {
        await confirmMfa({ ...values, version: pending.version }, controller.signal);
        if (!controller.signal.aborted) reset("complete");
      } else if (step === "login") {
        const data = new FormData();
        for (const [name, value] of Object.entries(values)) data.append(name, value);
        const result = await signIn(data);
        if (!controller.signal.aborted && result?.error) {
          setServerError(
            result.error +
              ("retryAfterSeconds" in result
                ? ` ${result.retryAfterSeconds}초 후 다시 시도해주세요.`
                : ""),
          );
          form.setValue("otp", "");
        } else if (!result) reset();
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof ApiError) {
        setServerError(
          error.code === "UNAUTHENTICATED"
            ? "인증 정보를 확인해주세요."
            : error.message +
                (error.retryAfterSeconds
                  ? ` ${error.retryAfterSeconds}초 후 다시 시도해주세요.`
                  : ""),
        );
      } else {
        // HTTP 파서의 원본 실패 객체에는 민감 응답이 포함될 수 있어 고정 오류만 보고한다.
        captureClientErrorOnce(new Error("Console authentication request failed"), {
          source: "admin-login-form",
        });
        setServerError("인증 중 오류가 발생했습니다. 다시 시도해주세요.");
      }
      form.setValue("otp", "");
    } finally {
      if (request.current === controller) {
        request.current = null;
        setLoading(false);
      }
    }
  }

  const credentials = step === "credentials" || step === "setup";
  return (
    <Card className="border-border bg-card shadow-xl">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-foreground text-2xl font-bold tracking-tight">
          어이어이 바위게
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          {step === "complete"
            ? "인증기 등록 완료"
            : step === "setup" || step === "confirm"
              ? "관리자 인증기 등록"
              : "관리자 계정으로 로그인하세요."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {step === "complete" ? (
          <div className="space-y-4" role="status">
            <p>다음 코드로 로그인하세요. 비밀번호를 다시 입력해주세요.</p>
            <Button onClick={() => reset()}>로그인으로 돌아가기</Button>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {serverError && (
                <p role="alert" className="text-destructive text-sm">
                  {serverError}
                </p>
              )}
              {!credentials && (
                <p className="text-muted-foreground text-sm">
                  {pending
                    ? "인증기 앱으로 QR을 스캔한 후 코드를 입력하세요."
                    : "인증기 앱의 코드를 입력하세요."}
                </p>
              )}
              {pending && (
                <Image
                  unoptimized
                  src={pending.qrDataUrl}
                  alt="인증기 등록 QR 코드"
                  width={256}
                  height={256}
                  className="mx-auto"
                />
              )}
              {(["email", "password", "otp"] as const)
                .filter((name) => (credentials ? name !== "otp" : name === "otp"))
                .map((name) => (
                  <FormField
                    key={name}
                    control={form.control}
                    name={name}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {name === "email"
                            ? "Email"
                            : name === "password"
                              ? "Password"
                              : "인증 코드"}
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type={name === "password" ? "password" : "text"}
                            autoComplete={
                              name === "email"
                                ? "email"
                                : name === "password"
                                  ? "current-password"
                                  : "one-time-code"
                            }
                            inputMode={
                              name === "otp" ? "numeric" : name === "email" ? "email" : undefined
                            }
                            maxLength={name === "otp" ? 6 : undefined}
                            disabled={!isHydrated || loading}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              <Button
                type="submit"
                className="bg-qwer-w hover:bg-qwer-w/90 h-11 w-full font-bold text-white"
                disabled={loading || !isHydrated}
              >
                {loading
                  ? "확인 중..."
                  : step === "credentials"
                    ? "다음"
                    : step === "setup"
                      ? "QR 생성"
                      : step === "confirm"
                        ? "등록 확인"
                        : "로그인"}
              </Button>
              {step === "credentials" ? (
                enrollmentEnabled && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => reset("setup")}
                    disabled={!isHydrated}
                  >
                    인증기 등록
                  </Button>
                )
              ) : (
                <Button type="button" variant="outline" onClick={() => reset()} disabled={loading}>
                  취소
                </Button>
              )}
            </form>
          </Form>
        )}
      </CardContent>
      <CardFooter className="border-border/50 flex justify-center border-t pt-4">
        <Link href="/" className="text-muted-foreground hover:text-foreground text-sm">
          홈으로 돌아가기
        </Link>
      </CardFooter>
    </Card>
  );
}
