export interface ManagedAlbum {
  id: number;
  name: string;
  slug: string;
  imgUrl: string;
  color: string;
  releaseDate: string | null;
  isVisible: boolean;
  createdAt: string;
}
