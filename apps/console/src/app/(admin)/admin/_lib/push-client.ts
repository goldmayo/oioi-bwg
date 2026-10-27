"use client";
import type { PushConfig } from "@oioi-bwg/contracts/notification";

type Handlers = {
  onMessage: (payload: unknown) => void;
  onRegistered: (fid: string) => Promise<void>;
  onError: (error: unknown) => void;
};
/** 권한 요청은 사용자 클릭 경계가 맡는다. 이 함수는 허용된 브라우저만 등록한다. */
export async function connectPush(
  config: PushConfig,
  handlers: Handlers,
  signal: AbortSignal,
): Promise<() => void> {
  if (Notification.permission !== "granted") throw new Error("PUSH_PERMISSION_REQUIRED");
  const [{ initializeApp, getApps, deleteApp }, sdk] = await Promise.all([
    import("firebase/app"),
    import("firebase/messaging"),
  ]);
  if (signal.aborted) return () => {};
  if (!(await sdk.isSupported())) throw new Error("PUSH_UNSUPPORTED");
  let app = getApps().find((item) => item.name === "oioi-console-push");
  if (app && app.options.projectId !== config.projectId) {
    await deleteApp(app);
    app = undefined;
  }
  const messaging = sdk.getMessaging(app ?? initializeApp(config, "oioi-console-push"));
  const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
    scope: "/",
    updateViaCache: "none",
  });
  await navigator.serviceWorker.ready;
  if (signal.aborted) return () => {};
  let pending = Promise.resolve();
  const offRegistered = sdk.onRegistered(messaging, (fid) => {
    if (signal.aborted) return;
    pending = handlers.onRegistered(fid);
    void pending.catch((error: unknown) => {
      if (!signal.aborted) handlers.onError(error);
    });
  });
  const offMessage = sdk.onMessage(messaging, (payload) => {
    if (!signal.aborted) handlers.onMessage(payload);
  });
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    offRegistered();
    offMessage();
    signal.removeEventListener("abort", stop);
  };
  signal.addEventListener("abort", stop, { once: true });
  try {
    await sdk.register(messaging, {
      vapidKey: config.vapidKey,
      serviceWorkerRegistration: registration,
    });
    await pending;
    if (signal.aborted) stop();
    return stop;
  } catch (error) {
    stop();
    throw error;
  }
}
export async function disconnectPush() {
  const [{ getApps }, sdk] = await Promise.all([
    import("firebase/app"),
    import("firebase/messaging"),
  ]);
  const app = getApps().find((item) => item.name === "oioi-console-push");
  if (app) await sdk.unregister(sdk.getMessaging(app));
}
