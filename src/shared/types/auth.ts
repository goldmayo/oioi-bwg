export interface AuthStrategy {
  getAccessToken: () => Promise<string | null>;
  refreshToken: () => Promise<string | null>; // 토큰 갱신 성공 시 새 토큰 반환, 실패 시 에러 throw
  onAuthError: () => void; // 갱신 실패 시 로그아웃 처리 및 리다이렉트
}
