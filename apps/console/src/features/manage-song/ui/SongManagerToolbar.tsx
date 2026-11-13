"use client";

import { Input } from "@/shared/ui/input";
import { ListFilterSheet } from "@/shared/ui/list-filter-sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";

interface Props {
  search: string;
  albumFilter: string;
  albums: { id: string; name: string }[];
  onSearchChange: (value: string) => void;
  onAlbumChange: (value: string) => void;
}

export function SongManagerToolbar({
  search,
  albumFilter,
  albums,
  onSearchChange,
  onAlbumChange,
}: Props) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Input
        placeholder="곡·앨범 검색"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        aria-label="곡 검색"
        className="h-11 min-w-0 flex-1 md:h-9 md:max-w-xs"
      />
      <ListFilterSheet
        title="곡 필터"
        description="선택한 앨범의 곡을 표시합니다."
        activeCount={albumFilter === "all" ? 0 : 1}
      >
        <div className="grid gap-1.5">
          <span className="text-muted-foreground text-xs">앨범</span>
          <Select value={albumFilter} onValueChange={onAlbumChange}>
            <SelectTrigger aria-label="앨범 필터" className="w-full data-[size=default]:h-11">
              <SelectValue placeholder="전체 앨범" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 앨범</SelectItem>
              {albums.map((album) => (
                <SelectItem key={album.id} value={String(album.id)}>
                  {album.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </ListFilterSheet>
    </div>
  );
}
