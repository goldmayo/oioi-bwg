import { initializeApp } from "firebase/app";
import { getMessaging } from "firebase/messaging/sw";
import type { PushConfig } from "@oioi-bwg/contracts/notification";
declare const self: ServiceWorkerGlobalScope & { __OIOI_PUSH_CONFIG__: PushConfig };
getMessaging(initializeApp(self.__OIOI_PUSH_CONFIG__));
self.addEventListener("install", () => {
  void self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
