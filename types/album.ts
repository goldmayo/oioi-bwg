export interface AlbumSong {
  title: string;
  file: string;
  hasOfficial?: boolean;
}

export interface Album {
  name: string;
  songs: AlbumSong[];
}
