import "server-only";

import { dispatchNotifications } from "@oioi-bwg/server/services/notification-delivery-service";

import { reportServerError } from "@/server/observability/server-error-reporter";

import { createFcmSender } from "./fcm";

type Dispatcher = { wake: () => void };
const processState = globalThis as typeof globalThis & {
  __oioiNotificationDispatcher?: Dispatcher;
};
export function wakeNotificationDispatcher() {
  processState.__oioiNotificationDispatcher?.wake();
}
export function startNotificationDispatcher() {
  if (processState.__oioiNotificationDispatcher) return;
  const send = createFcmSender();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false;
  let wakeRequested = false;
  function report(code: string) {
    reportServerError(new Error(`Notification dispatch ${code}`), {
      event: "notification.dispatch_failed",
      source: "notification-dispatcher",
    });
  }
  async function run() {
    if (running) {
      wakeRequested = true;
      return;
    }
    running = true;
    wakeRequested = false;
    try {
      const codes = new Set<string>();
      const count = await dispatchNotifications(send, (code) => {
        if (!codes.has(code)) {
          codes.add(code);
          report(code);
        }
      });
      if (count === 20) wakeRequested = true;
    } catch {
      report("DATABASE");
    } finally {
      running = false;
      timer = setTimeout(
        () => {
          void run();
        },
        wakeRequested ? 0 : 60_000,
      );
      timer.unref();
    }
  }
  processState.__oioiNotificationDispatcher = {
    wake() {
      if (running) {
        wakeRequested = true;
        return;
      }
      clearTimeout(timer);
      timer = setTimeout(() => {
        void run();
      }, 0);
      timer.unref();
    },
  };
  wakeNotificationDispatcher();
}
