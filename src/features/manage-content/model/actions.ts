export interface ManageContentActionResult {
  success: boolean;
  error?: string;
}

export type CreateAlbumAction = (formData: unknown) => Promise<ManageContentActionResult>;
export type UpdateAlbumAction = (
  id: number,
  formData: unknown,
) => Promise<ManageContentActionResult>;
export type DeleteAlbumAction = (id: number) => Promise<ManageContentActionResult>;
export type CreateSongAction = (formData: unknown) => Promise<ManageContentActionResult>;
export type UpdateSongAction = (
  id: number,
  formData: unknown,
) => Promise<ManageContentActionResult>;
export type DeleteSongAction = (id: number) => Promise<ManageContentActionResult>;
