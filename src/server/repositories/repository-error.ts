export class AlbumSlugConflictError extends Error {
  constructor() {
    super("Album slug conflicts with an existing album");
    this.name = "AlbumSlugConflictError";
  }
}

export class SongSlugConflictError extends Error {
  constructor() {
    super("Song slug conflicts with an existing song");
    this.name = "SongSlugConflictError";
  }
}

export class ProfileNicknameConflictError extends Error {
  constructor() {
    super("Profile nickname conflicts with an existing profile");
    this.name = "ProfileNicknameConflictError";
  }
}

export class PasswordCredentialEmailConflictError extends Error {
  constructor() {
    super("Credential email conflicts with an existing credential");
    this.name = "PasswordCredentialEmailConflictError";
  }
}
