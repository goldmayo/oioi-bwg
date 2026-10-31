"use client";

import { type FormEvent, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import {
  operatorApprovalInputSchema,
  operatorApprovalResultSchema,
} from "@oioi-bwg/contracts/operator-auth";
import Link from "next/link";

import { captureClientErrorOnce } from "@/shared/api/capture-client-error";
import { http } from "@/shared/api/http-client";
import { ApiError, parseClientResponse } from "@/shared/api/http-errors";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

const subscribeToHydration = () => () => undefined;

/** 연결 코드는 폼 메모리에만 두며 URL·Query cache·storage에 보관하지 않는다. */
export function OperatorConnectForm() {
  const isHydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const form = useForm({
    resolver: standardSchemaResolver(operatorApprovalInputSchema),
    defaultValues: { userCode: "" },
  });
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    await form.handleSubmit(async (input) => {
      if (active.current) return;
      const controller = new AbortController();
      active.current = controller;
      setError(null);
      try {
        parseClientResponse(
          operatorApprovalResultSchema,
          await http.post("/api/operator/auth/approve", {
            json: input,
            signal: controller.signal,
            cache: "no-store",
          }),
        );
        if (!controller.signal.aborted) {
          form.reset({ userCode: "" });
          setApproved(true);
        }
      } catch (failure) {
        if (controller.signal.aborted) return;
        if (failure instanceof ApiError) {
          setError(
            failure.code === "FORBIDDEN"
              ? "연결 코드와 로그인 상태를 확인해 주세요. 코드가 만료됐다면 CLI에서 로그인을 다시 시작해 주세요."
              : failure.message +
                  (failure.retryAfterSeconds
                    ? ` ${failure.retryAfterSeconds}초 후 다시 시도해 주세요.`
                    : ""),
          );
        } else {
          captureClientErrorOnce(new Error("Operator approval request failed"), {
            source: "operator-connect-form",
          });
          setError(
            "연결 승인 결과를 확인하지 못했습니다. CLI 상태를 확인한 뒤 다시 시도해 주세요.",
          );
        }
      } finally {
        if (active.current === controller) active.current = null;
      }
    })(event);
  }
  return (
    <section aria-labelledby="operator-heading" className="w-full max-w-md space-y-6">
      <div className="space-y-2">
        <h1 id="operator-heading" className="text-foreground text-2xl font-bold">
          로컬 CLI 연결
        </h1>
        <p className="text-muted-foreground text-sm">
          직접 실행한 oioi-operator에 표시된 연결 코드를 입력합니다.
        </p>
      </div>
      {approved ? (
        <div role="status" className="space-y-2">
          <h2 className="font-semibold">연결을 승인했습니다.</h2>
          <p className="text-sm">CLI로 돌아가 작업을 계속하세요. 이 창을 닫아도 됩니다.</p>
        </div>
      ) : (
        <>
          <div className="space-y-2 text-sm">
            <p>현재 관리자 계정으로 기존 곡 조회와 파형 조회·등록을 허용합니다.</p>
            <p className="text-muted-foreground">
              연결은 토큰 발급 후 최대 8시간 유지됩니다. 사용 후 CLI에서 로그아웃하면 연결이
              해제됩니다.
            </p>
          </div>
          <form method="post" onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="operator-code">연결 코드</Label>
              <Input
                id="operator-code"
                {...form.register("userCode")}
                placeholder="ABCD-2345"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={9}
                disabled={!isHydrated || form.formState.isSubmitting}
                aria-invalid={Boolean(form.formState.errors.userCode)}
                aria-describedby="operator-code-help"
                className="h-11 font-mono text-lg uppercase"
              />
              <p id="operator-code-help" className="text-muted-foreground text-sm">
                하이픈을 포함한 9자리입니다. 코드는 10분 후 만료됩니다.
              </p>
              {form.formState.errors.userCode && (
                <p role="alert" className="text-destructive text-sm">
                  CLI에 표시된 연결 코드를 확인해 주세요.
                </p>
              )}
            </div>
            {error && (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            )}
            <Button
              type="submit"
              disabled={!isHydrated || form.formState.isSubmitting}
              className="h-11 w-full"
            >
              {form.formState.isSubmitting ? "승인 중..." : "연결 승인"}
            </Button>
          </form>
        </>
      )}
      <Link
        href="/admin"
        className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center text-sm underline underline-offset-4"
      >
        관리 화면으로 돌아가기
      </Link>
    </section>
  );
}
