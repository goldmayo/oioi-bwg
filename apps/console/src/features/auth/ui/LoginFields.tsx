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
            <FormLabel>Email</FormLabel>
            <FormControl>
              <Input
                {...field}
                type="text"
                autoComplete="email"
                inputMode="email"
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
            <FormLabel>Password</FormLabel>
            <FormControl>
              <Input
                {...field}
                type="password"
                autoComplete="current-password"
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
              disabled={disabled}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
