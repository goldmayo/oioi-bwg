export interface ManageAlbumActionResult {
  success: boolean;
  error?: string;
}

export type CreateAlbumAction = (formData: unknown) => Promise<ManageAlbumActionResult>;
export type UpdateAlbumAction = (id: number, formData: unknown) => Promise<ManageAlbumActionResult>;
export type DeleteAlbumAction = (id: number) => Promise<ManageAlbumActionResult>;
