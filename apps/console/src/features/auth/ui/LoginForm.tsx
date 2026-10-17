"use client";

import Image from "next/image";
import Link from "next/link";

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
  credentials: { description: "관리자 계정으로 로그인하세요.", submitLabel: "다음" },
  login: { description: "관리자 계정으로 로그인하세요.", submitLabel: "로그인" },
  setup: { description: "관리자 인증기 등록", submitLabel: "QR 생성" },
  confirm: { description: "관리자 인증기 등록", submitLabel: "등록 확인" },
  complete: { description: "인증기 등록 완료", submitLabel: "로그인으로 돌아가기" },
};

export default function LoginForm({ enrollmentEnabled = false }: { enrollmentEnabled?: boolean }) {
  // 모델은 인증 요청/폐기를 소유하고, 이 컴포넌트는 현재 단계에 맞는 입력과 안내만 표시한다.
  const { form, step, serverError, loading, isHydrated, submit, reset } = useConsoleLoginForm();
  const screen = screens[step.kind];
  const disabled = !isHydrated || loading;
  const showCredentials = step.kind === "credentials" || step.kind === "setup";

  return (
    <Card className="border-border bg-card shadow-xl">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-foreground text-2xl font-bold tracking-tight">
          어이어이 바위게
        </CardTitle>
        <CardDescription className="text-muted-foreground">{screen.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {step.kind === "complete" ? (
          <div className="space-y-4" role="status">
            <p>다음 코드로 로그인하세요. 비밀번호를 다시 입력해주세요.</p>
            <Button className="h-11 w-full" onClick={() => reset()}>
              {screen.submitLabel}
            </Button>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
              {serverError && (
                <p role="alert" className="text-destructive text-sm">
                  {serverError}
                </p>
              )}
              {!showCredentials && (
                <p className="text-muted-foreground text-sm">
                  {step.kind === "confirm"
                    ? "인증기 앱으로 QR을 스캔한 후 코드를 입력하세요."
                    : "인증기 앱의 코드를 입력하세요."}
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
                className="bg-qwer-w hover:bg-qwer-w/90 h-11 w-full font-bold text-white"
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
