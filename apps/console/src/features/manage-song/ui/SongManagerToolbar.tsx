"use client";

import { Input } from "@/shared/ui/input";
import { FilterSelect, ListFilterSheet } from "@/shared/ui/list-filter-sheet";
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
      <Select value={albumFilter} onValueChange={onAlbumChange}>
        <SelectTrigger
          aria-label="앨범 필터"
          className="hidden w-40 shrink-0 data-[size=default]:h-9 md:flex"
        >
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
      <ListFilterSheet
        id="song-filters"
        title="곡 필터"
        activeCount={albumFilter === "all" ? 0 : 1}
        values={{ album: albumFilter }}
        defaults={{ album: "all" }}
        onApply={({ album }) => onAlbumChange(album)}
      >
        {({ control }) => (
          <FilterSelect label="앨범" control={control} name={"album"}>
            <option value="all">전체 앨범</option>
            {albums.map(({ id, name }) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </FilterSelect>
        )}
      </ListFilterSheet>
    </div>
  );
}
