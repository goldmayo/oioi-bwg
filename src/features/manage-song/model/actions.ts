export interface ManageSongActionResult {
  success: boolean;
  error?: string;
}

export type CreateSongAction = (formData: unknown) => Promise<ManageSongActionResult>;
export type UpdateSongAction = (id: number, formData: unknown) => Promise<ManageSongActionResult>;
export type DeleteSongAction = (id: number) => Promise<ManageSongActionResult>;
