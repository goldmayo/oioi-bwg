import type { Control } from "react-hook-form";

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { Input } from "@/shared/ui/input";

import type { ConsoleLoginValues } from "../model/use-console-login-form";

type Props = { control: Control<ConsoleLoginValues>; disabled: boolean };

export function CredentialsFields({ control, disabled }: Props) {
  return (
    <>
      <FormField
        control={control}
        name="email"
        render={({ field }) => (
          <FormItem>
            <FormLabel>이메일</FormLabel>
            <FormControl>
              <Input
                {...field}
                type="text"
                autoComplete="email"
                inputMode="email"
                className="h-11"
                disabled={disabled}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="password"
        render={({ field }) => (
          <FormItem>
            <FormLabel>비밀번호</FormLabel>
            <FormControl>
              <Input
                {...field}
                type="password"
                autoComplete="current-password"
                className="h-11"
                disabled={disabled}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}

export function OtpField({ control, disabled }: Props) {
  return (
    <FormField
      control={control}
      name="otp"
      render={({ field }) => (
        <FormItem>
          <FormLabel>인증 코드</FormLabel>
          <FormControl>
            <Input
              {...field}
              type="text"
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={6}
              className="h-11 text-center text-lg tracking-[0.3em] tabular-nums"
              disabled={disabled}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
