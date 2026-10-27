"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { notificationPushSchema, type PushConfig } from "@oioi-bwg/contracts/notification";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  notificationQueries,
  notificationQueryKeys,
  readNotification,
  registerPushInstallation,
  unregisterPushInstallation,
} from "@/entities/notification";
import { waveformQueryKeys } from "@/entities/waveform";

import { connectPush, disconnectPush } from "../_lib/push-client";

type PushState = "unavailable" | "unsupported" | "denied" | "disabled" | "enabled" | "loading";
const context = createContext<{
  accountId: string;
  pushState: PushState;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
} | null>(null);
const preference = "oioi:push-disabled:v1";
const installationKey = "oioi:push-installation:v1";
function stored(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function save(key: string, value?: string) {
  try {
    if (value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {}
}
export function useNotificationContext() {
  const value = useContext(context);
  if (!value) throw new Error("NotificationProvider missing");
  return value;
}
export function NotificationProvider({
  accountId,
  config,
  children,
}: {
  accountId: string;
  config: PushConfig | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { mutateAsync: bind } = useMutation({ mutationFn: registerPushInstallation });
  const { mutateAsync: unbind } = useMutation({ mutationFn: unregisterPushInstallation });
  const { mutateAsync: read } = useMutation({ mutationFn: readNotification });
  const [pushState, setPushState] = useState<PushState>(config ? "loading" : "unavailable");
  const controller = useRef<AbortController | null>(null);
  const seen = useRef(new Set<string>());
  const start = useCallback(async () => {
    if (!config) return;
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setPushState("loading");
    const receive = async (payload: unknown) => {
      const data =
        typeof payload === "object" && payload !== null && "data" in payload
          ? payload.data
          : undefined;
      const parsed = notificationPushSchema.safeParse(data);
      if (!parsed.success) return;
      const id = parsed.data.notificationId;
      if (seen.current.has(id)) return;
      seen.current.add(id);
      try {
        const [, item] = await Promise.all([
          queryClient.invalidateQueries({ queryKey: notificationQueryKeys.all(accountId) }),
          queryClient.fetchQuery(notificationQueries.detail(accountId, id)),
        ]);
        await queryClient.invalidateQueries({ queryKey: waveformQueryKeys.all(accountId) });
        if (
          current.signal.aborted ||
          item.readAt ||
          document.visibilityState !== "visible" ||
          !document.hasFocus() ||
          new URLSearchParams(location.search).get("notificationId") === id
        )
          return;
        const show = item.type === "WAVEFORM_SUCCEEDED" ? toast.success : toast.error;
        show(item.title, {
          id,
          action: {
            label: "결과 보기",
            onClick: () => {
              void read(id)
                .then(() => {
                  void queryClient.invalidateQueries({
                    queryKey: notificationQueryKeys.all(accountId),
                  });
                  router.push(item.href);
                })
                .catch(() => {
                  toast.error("알림을 열지 못했습니다. 알림함에서 다시 시도해 주세요.");
                });
            },
          },
        });
      } catch {
        seen.current.delete(id);
      }
    };
    try {
      await connectPush(
        config,
        {
          onMessage: (payload) => {
            void receive(payload);
          },
          onRegistered: async (fid) => {
            const result = await bind(fid);
            if (!current.signal.aborted) save(installationKey, result.id);
          },
          onError: () => {
            if (!current.signal.aborted) setPushState("disabled");
          },
        },
        current.signal,
      );
      if (!current.signal.aborted) setPushState("enabled");
    } catch (error) {
      if (!current.signal.aborted)
        setPushState(
          error instanceof Error && error.message === "PUSH_UNSUPPORTED"
            ? "unsupported"
            : "disabled",
        );
    }
  }, [accountId, bind, config, queryClient, read, router]);
  const disable = useCallback(async () => {
    save(preference, "true");
    controller.current?.abort();
    setPushState("disabled");
    const id = stored(installationKey);
    try {
      if (id) await unbind(id);
      save(installationKey);
    } finally {
      await disconnectPush().catch(() => {});
    }
  }, [unbind]);
  const enable = async () => {
    if (
      !("Notification" in window) ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      setPushState("unsupported");
      return;
    }
    const permission =
      Notification.permission === "default"
        ? await Notification.requestPermission()
        : Notification.permission;
    if (permission !== "granted") {
      setPushState("denied");
      return;
    }
    save(preference);
    await start();
  };
  useEffect(() => {
    if (!config) return;
    let active = true;
    const refresh = async () => {
      await Promise.resolve();
      if (!active) return;
      if (
        !("Notification" in window) ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window)
      ) {
        setPushState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        controller.current?.abort();
        setPushState("denied");
        const id = stored(installationKey);
        if (id) {
          await unbind(id)
            .then(() => save(installationKey))
            .catch(() => {});
        }
        return;
      }
      if (stored(preference) === "true") {
        controller.current?.abort();
        setPushState("disabled");
        const id = stored(installationKey);
        if (id)
          await unbind(id)
            .then(() => save(installationKey))
            .catch(() => {});
        return;
      }
      if (Notification.permission === "granted") await start();
      else setPushState("disabled");
    };
    void refresh();
    const onFocus = () => {
      void refresh();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);
    return () => {
      active = false;
      controller.current?.abort();
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
    };
  }, [config, start, unbind]);
  return (
    <context.Provider value={{ accountId, pushState, enable, disable }}>
      {children}
    </context.Provider>
  );
}
