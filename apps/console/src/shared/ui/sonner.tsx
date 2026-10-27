"use client";

import { useSyncExternalStore } from "react";
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const desktopQuery = "(min-width: 768px)";
function subscribe(onChange: () => void) {
  const query = window.matchMedia(desktopQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const desktopSnapshot = () => window.matchMedia(desktopQuery).matches;
const serverSnapshot = () => false;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();
  const desktop = useSyncExternalStore(subscribe, desktopSnapshot, serverSnapshot);

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position={desktop ? "bottom-right" : "top-center"}
      closeButton
      duration={6000}
      gap={12}
      offset={24}
      mobileOffset={{ top: "max(16px, env(safe-area-inset-top))", left: 16, right: 16 }}
      containerAriaLabel="알림"
      toastOptions={{
        closeButtonAriaLabel: "알림 닫기",
        classNames: {
          toast: "!rounded-xl !p-4 !gap-3 shadow-lg",
          title: "!text-sm !font-semibold !leading-6",
          description: "!text-muted-foreground !text-sm !leading-6",
          actionButton: "!bg-secondary !text-secondary-foreground !h-9 !px-3 !text-xs !font-medium",
          closeButton: "!bg-popover !border-border !text-muted-foreground",
        },
      }}
      icons={{
        success: <CircleCheckIcon className="size-5 text-emerald-400" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="text-destructive size-5" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
