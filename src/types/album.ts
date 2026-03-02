export interface AlbumSong {
  title: string;
  file: string;
  hasOfficial?: boolean;
  youtubeId: string;
}

export interface Album {
  name: string;
  songs: AlbumSong[];
}
