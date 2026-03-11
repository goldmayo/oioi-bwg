"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { updateSong } from "@/libs/db/drizzle/commands"; // 명령 헬퍼 사용
import { createClient } from "@/libs/db/supabase/server";
import { LyricsDataSchema } from "@/types/lyrics";

/**
 * 관리자 로그인 액션
 */
export async function signIn(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  // 관리자 권한 체크 (app_metadata를 사용)
  const userRole = data.user.app_metadata?.role;
  if (userRole !== "admin") {
    await supabase.auth.signOut();
    return { error: "관리자 권한이 없습니다." };
  }

  // 로그인 시 전체 레이아웃 재검증하여 헤더/사이드바 등 최신화
  revalidatePath("/", "layout");
  redirect("/");
}

/**
 * 로그아웃 액션
 */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  // 로그아웃 시 전체 레이아웃 재검증
  revalidatePath("/", "layout");
  redirect("/"); // /login 페이지가 따로 없으므로 /admin(로그인 폼 렌더링)으로 보냄
}

/**
 * 가사 데이터 저장 액션
 */
export async function saveSongData(songId: number, data: { lyrics: unknown; youtubeId: string }) {
  try {
    const validatedLyrics = LyricsDataSchema.parse(data.lyrics);

    /**
     * [Drizzle/Commands] updateSong 내부에서 이미 updateTag를 수행합니다.
     * 따라서 데이터베이스 레벨의 캐시는 즉시 갱신됩니다.
     */
    await updateSong(songId, {
      lyrics: validatedLyrics,
      youtubeId: data.youtubeId,
    });

    /**
     * 클라이언트 라우터 캐시 및 페이지 레이아웃 재검증
     * 루트 경로의 레이아웃을 무효화하여 모든 하위 경로(메인, 상세, 어드민)의 일관성을 맞춥니다.
     */
    revalidatePath("/", "layout");

    return { success: true };
  } catch (error) {
    console.error("Failed to save song data:", error);
    return { success: false, error: "데이터 검증 또는 저장에 실패했습니다." };
  }
}
