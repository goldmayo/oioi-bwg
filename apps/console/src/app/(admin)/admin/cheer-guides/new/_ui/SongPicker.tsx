"use client";

import { type ComponentProps, useState } from "react";
import { Command } from "cmdk";
import { Check, ChevronsUpDown } from "lucide-react";
import { Popover } from "radix-ui";

import type { AdminSongSummary } from "@/entities/song";

import { Button } from "@/shared/ui/button";

export function SongPicker({
  songs,
  value,
  onValueChange,
  ...props
}: {
  songs: AdminSongSummary[];
  value: string;
  onValueChange: (value: string) => void;
} & Omit<ComponentProps<typeof Button>, "value" | "onChange" | "children">) {
  const [open, setOpen] = useState(false);
  const selected = songs.find((song) => song.id === value);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button
          {...props}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-11 w-full justify-between px-3 font-normal"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="truncate">{selected?.title || "곡 선택"}</span>
            {selected && (
              <span className="text-muted-foreground shrink-0">{selected.album.name}</span>
            )}
          </span>
          <ChevronsUpDown className="text-muted-foreground size-4 shrink-0" />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="bg-popover text-popover-foreground z-50 w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] overflow-hidden rounded-md border shadow-md"
        >
          <Command label="곡 검색">
            <Command.Input
              placeholder="곡 제목·앨범명 검색"
              aria-label="곡 제목·앨범명 검색"
              className="placeholder:text-muted-foreground h-11 w-full border-b bg-transparent px-3 text-sm outline-none"
            />
            <Command.List className="max-h-64 overflow-y-auto p-1">
              <Command.Empty className="text-muted-foreground p-4 text-center text-sm">
                검색 결과가 없습니다.
              </Command.Empty>
              {songs.map((song) => (
                <Command.Item
                  key={song.id}
                  value={song.id}
                  keywords={[song.title, song.album.name]}
                  onSelect={() => {
                    onValueChange(song.id);
                    setOpen(false);
                  }}
                  className="data-[selected=true]:bg-accent flex cursor-pointer items-center gap-3 rounded-sm px-2 py-2.5 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate">{song.title}</span>
                  <span className="text-muted-foreground shrink-0">{song.album.name}</span>
                  <Check
                    aria-hidden
                    className={song.id === value ? "size-4 shrink-0" : "invisible size-4 shrink-0"}
                  />
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
