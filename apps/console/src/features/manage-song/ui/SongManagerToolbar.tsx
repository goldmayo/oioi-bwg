"use client";

import { Input } from "@/shared/ui/input";
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
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 flex-col gap-2 sm:flex-row">
        <Input
          placeholder="곡 제목, slug, 앨범명으로 검색..."
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          aria-label="곡 검색"
          className="sm:max-w-xs"
        />
        <Select value={albumFilter} onValueChange={onAlbumChange}>
          <SelectTrigger aria-label="앨범 필터" className="w-full sm:w-40">
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
    </div>
  );
}
