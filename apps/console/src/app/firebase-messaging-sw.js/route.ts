import { getPushConfig } from "@/server/notifications/config";
export const dynamic = "force-dynamic";
export async function GET() {
  const config = getPushConfig();
  const script = config
    ? `self.__OIOI_PUSH_CONFIG__=${JSON.stringify(config).replaceAll("<", "\\u003c")};importScripts("/notification-worker.js");`
    : 'self.addEventListener("install",()=>self.skipWaiting());self.addEventListener("activate",event=>event.waitUntil(self.registration.unregister()));';
  return new Response(script, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "no-store",
      "Service-Worker-Allowed": "/",
    },
  });
}
