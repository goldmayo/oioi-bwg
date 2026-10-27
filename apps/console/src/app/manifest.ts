import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/admin",
    name: "어이어이바위게 관리자",
    short_name: "어이어이 관리",
    start_url: "/admin",
    scope: "/",
    display: "standalone",
    background_color: "#101010",
    theme_color: "#101010",
    icons: [{ src: "/notification-icon.png", sizes: "192x192", type: "image/png" }],
  };
}
