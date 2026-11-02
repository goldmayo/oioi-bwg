"use client";

import Image from "next/image";
import Link from "next/link";

import { AppLogo } from "@/shared/ui/app-logo";
import { Button } from "@/shared/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { Form } from "@/shared/ui/form";

import { useConsoleLoginForm } from "../model/use-console-login-form";

import { CredentialsFields, OtpField } from "./LoginFields";

const screens = {
  credentials: { description: null, submitLabel: "다음" },
  login: { description: null, submitLabel: "로그인" },
  setup: { description: "관리자 인증기 등록", submitLabel: "QR 생성" },
  confirm: { description: "관리자 인증기 등록", submitLabel: "등록 확인" },
  complete: { description: "인증기 등록 완료", submitLabel: "로그인으로 돌아가기" },
  navigating: { description: "로그인 완료", submitLabel: "이동 중..." },
};

const loginActionClassName =
  "bg-foreground/65 text-background hover:bg-foreground/75 h-11 w-full font-semibold";

export default function LoginForm({
  enrollmentEnabled = false,
  initialRateLimited = false,
  destination = "admin",
}: {
  enrollmentEnabled?: boolean;
  initialRateLimited?: boolean;
  destination?: "admin" | "operator";
}) {
  // 모델은 인증 요청/폐기를 소유하고, 이 컴포넌트는 현재 단계에 맞는 입력과 안내만 표시한다.
  const { form, step, serverError, loading, isHydrated, submit, reset } = useConsoleLoginForm(
    initialRateLimited,
    destination,
  );
  const screen = screens[step.kind];
  const disabled = !isHydrated || loading;
  const showCredentials = step.kind === "credentials" || step.kind === "setup";

  return (
    <Card className="border-border bg-card pb-4 shadow-none">
      <CardHeader className="space-y-1 text-center">
        <h1 className="sr-only">관리자 로그인</h1>
        <CardTitle className="flex justify-center">
          <AppLogo className="text-2xl" />
        </CardTitle>
        {screen.description && (
          <CardDescription className="text-muted-foreground">{screen.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {step.kind === "navigating" ? (
          <p role="status" className="text-muted-foreground text-center text-sm">
            {destination === "operator"
              ? "CLI 연결 승인 화면으로 이동 중입니다."
              : "관리 화면으로 이동 중입니다."}
          </p>
        ) : step.kind === "complete" ? (
          <div className="space-y-4" role="status">
            <p>다음 코드로 로그인하세요. 비밀번호를 다시 입력해주세요.</p>
            <Button variant="default" className={loginActionClassName} onClick={() => reset()}>
              {screen.submitLabel}
            </Button>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={submit} className="space-y-4">
              {serverError && (
                <p role="alert" className="text-destructive text-sm">
                  {serverError}
                </p>
              )}
              {!showCredentials && (
                <p className="text-muted-foreground text-sm">
                  {step.kind === "confirm"
                    ? "인증기 앱으로 QR을 스캔한 후 코드를 입력하세요."
                    : "인증기 앱의 6자리 코드를 입력하세요."}
                </p>
              )}
              {step.kind === "confirm" && (
                // QR에는 TOTP secret이 담겨 있다. 확인 단계의 폼 메모리에서만 표시한다.
                <Image
                  unoptimized
                  src={step.enrollment.qrDataUrl}
                  alt="인증기 등록 QR 코드"
                  width={256}
                  height={256}
                  className="mx-auto"
                />
              )}
              {showCredentials ? (
                <CredentialsFields control={form.control} disabled={disabled} />
              ) : (
                <OtpField control={form.control} disabled={disabled} />
              )}
              <Button
                type="submit"
                variant="default"
                className={loginActionClassName}
                disabled={disabled}
              >
                {loading ? "확인 중..." : screen.submitLabel}
              </Button>
              {step.kind === "credentials" ? (
                enrollmentEnabled && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => reset("setup")}
                    disabled={!isHydrated}
                    className="h-11 w-full font-bold"
                  >
                    인증기 등록
                  </Button>
                )
              ) : (
                <Button
                  type="button"
                  className="h-11 w-full font-semibold"
                  variant="destructive"
                  onClick={() => reset()}
                  disabled={loading}
                >
                  취소
                </Button>
              )}
            </form>
          </Form>
        )}
      </CardContent>
      <CardFooter className="flex justify-center pt-0">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded-sm px-2 py-1 text-sm underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
        >
          홈으로 돌아가기
        </Link>
      </CardFooter>
    </Card>
  );
}
