"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { signIn } from "@/features/auth/actions";
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

/**
 * 로그인 폼 유효성 검사 스키마
 */
const loginSchema = z.object({
  email: z.email({ message: "올바른 이메일 형식을 입력해주세요." }),
  password: z.string().min(6, { message: "비밀번호는 최소 6자 이상이어야 합니다." }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: standardSchemaResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: LoginFormValues) {
    setLoading(true);
    setServerError(null);

    try {
      const formData = new FormData();
      formData.append("email", values.email);
      formData.append("password", values.password);

      const result = await signIn(formData);

      if (result && "error" in result) {
        setServerError(result.error);
        setLoading(false);
      }
    } catch (_e) {
      setServerError("로그인 중 오류가 발생했습니다.");
      setLoading(false);
    }
  }

  return (
    <Card className="border-border bg-card shadow-xl">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-foreground text-2xl font-bold tracking-tight">
          어이어이 바위게
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          관리자 계정으로 로그인하세요.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {serverError && (
              <div className="bg-destructive/10 text-destructive border-destructive/20 rounded-md border p-3 text-center text-sm font-medium">
                {serverError}
              </div>
            )}

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="admin@example.com"
                      className="border-input bg-background focus-visible:ring-qwer-w/50"
                      autoComplete="email"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="********"
                      className="border-input bg-background focus-visible:ring-qwer-w/50"
                      autoComplete="current-password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="bg-qwer-w hover:bg-qwer-w/90 mt-2 h-11 w-full font-bold text-white"
              disabled={loading}
            >
              {loading ? "로그인 중..." : "로그인"}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="border-border/50 flex justify-center border-t pt-4">
        <Link href="/" className="text-muted-foreground hover:text-foreground text-sm">
          홈으로 돌아가기
        </Link>
      </CardFooter>
    </Card>
  );
}
