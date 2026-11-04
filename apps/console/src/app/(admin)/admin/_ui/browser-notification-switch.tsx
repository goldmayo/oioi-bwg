"use client";

import { useId, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Switch } from "@/shared/ui/switch";

import { useNotificationContext } from "./notification-provider";

const messages = {
  unavailable: "브라우저 알림을 사용할 수 없습니다. 결과는 알림함에서 확인할 수 있습니다.",
  unsupported: "브라우저 알림을 사용할 수 없습니다. 결과는 알림함에서 확인할 수 있습니다.",
  denied: "브라우저 설정에서 알림을 허용하면 작업 결과를 받아볼 수 있습니다.",
  loading: "브라우저 알림을 설정하고 있습니다.",
  disabled: undefined,
  enabled: undefined,
};
export function BrowserNotificationSwitch({ inSheet = false }: { inSheet?: boolean }) {
  const { pushState, enable, disable } = useNotificationContext();
  const id = useId();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const enabled = pushState === "enabled";
  const changing = pending || pushState === "loading";
  const statusLabel = enabled ? "ON" : "OFF";
  const message = error || messages[pushState];
  const blocked = changing || ["unavailable", "unsupported", "denied"].includes(pushState);
  const change = async (next: boolean) => {
    if (blocked || busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      await (next ? enable() : disable());
    } catch {
      setError("브라우저 알림 설정을 변경하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  return (
    <div
      className={cn(
        "flex flex-col gap-1",
        inSheet ? "items-stretch" : "ml-auto max-w-xs items-end",
      )}
    >
      <div
        role="group"
        aria-label="브라우저 알림 설정"
        className={cn(
          "border-input bg-card inline-flex shrink-0 items-center gap-3 rounded-md border px-3",
          inSheet ? "min-h-12" : "h-9",
        )}
      >
        <label
          htmlFor={id}
          className={cn(
            "cursor-pointer text-sm font-medium whitespace-nowrap",
            inSheet && "mr-auto py-3",
          )}
        >
          브라우저 알림
        </label>
        <Switch
          id={id}
          className={cn(
            "dark:data-[state=checked]:bg-qwer-q dark:data-[state=unchecked]:border-input dark:data-[state=unchecked]:bg-muted dark:data-[state=unchecked]:[&_[data-slot=switch-thumb]]:bg-input",
            inSheet &&
              "data-[size=default]:h-6 data-[size=default]:w-11 [&_[data-slot=switch-thumb]]:size-5! [&_[data-slot=switch-thumb][data-state=checked]]:translate-x-[22px]!",
          )}
          checked={enabled}
          disabled={blocked}
          aria-busy={changing}
          aria-describedby={message ? `${id}-message` : undefined}
          onCheckedChange={(next) => {
            void change(next);
          }}
        />
        {changing || !inSheet ? (
          <span className="w-7 text-center text-xs font-medium" aria-hidden="true">
            {changing ? <Loader2 className="mx-auto size-3.5 animate-spin" /> : statusLabel}
          </span>
        ) : null}
      </div>
      {message && (
        <p
          id={`${id}-message`}
          role={error ? "alert" : "status"}
          className={`text-xs leading-5 ${error ? "text-destructive" : "text-muted-foreground"}`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
