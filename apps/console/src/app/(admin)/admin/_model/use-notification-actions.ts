"use client";

import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import {
  notificationQueries,
  notificationQueryKeys,
  readAllNotifications,
  readNotification,
} from "@/entities/notification";

import { useConfirmNavigation } from "@/shared/model/navigation-confirmation";

export function useNotificationActions(
  accountId: string,
  options: {
    selectedId?: string;
    onNavigate?: () => void;
    onReadAll?: () => void | Promise<unknown>;
  } = {},
) {
  const client = useQueryClient();
  const router = useRouter();
  const confirmNavigation = useConfirmNavigation();
  const processed = useRef<string | null>(null);
  const opening = useRef(false);
  const invalidate = () =>
    client.invalidateQueries({ queryKey: notificationQueryKeys.all(accountId) });
  const read = useMutation({ mutationFn: readNotification, onSuccess: invalidate });
  const all = useMutation({
    mutationFn: readAllNotifications,
    onSuccess: async () => {
      await options.onReadAll?.();
      await invalidate();
    },
  });
  const selected = useQuery({
    ...notificationQueries.detail(accountId, options.selectedId ?? ""),
    enabled: Boolean(options.selectedId),
  });
  const open = (id: string) => {
    if (opening.current) return;
    opening.current = true;
    void read
      .mutateAsync(id)
      .then((item) => {
        confirmNavigation(() => {
          options.onNavigate?.();
          router.push(item.href);
        });
      })
      .catch(() => {})
      .finally(() => {
        opening.current = false;
      });
  };
  const { mutateAsync: markRead } = read;
  useEffect(() => {
    const item = selected.data;
    if (!item || processed.current === item.id) return;
    processed.current = item.id;
    void markRead(item.id)
      .then(() => {
        confirmNavigation(() => router.replace(item.href));
      })
      .catch(() => {
        processed.current = null;
      });
  }, [confirmNavigation, markRead, router, selected.data]);
  return { read, all, selected, open };
}
