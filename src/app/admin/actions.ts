"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/libs/prisma";
import { LyricsDataSchema } from "@/types/lyrics";
import { createClient } from "@/utils/supabase/server";

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

  // 관리자 권한 체크 (user_metadata 또는 app_metadata 사용 가능)
  const userRole = data.user.user_metadata?.role;
  if (userRole !== "admin") {
    await supabase.auth.signOut();
    return { error: "관리자 권한이 없습니다." };
  }

  revalidatePath("/", "layout");
  redirect("/admin");
}

/**
 * 로그아웃 액션
 */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

/**
 * 가사 데이터 저장 액션
 */
export async function saveSongData(songId: number, data: { lyrics: unknown; youtubeId: string }) {
  try {
    const validatedLyrics = LyricsDataSchema.parse(data.lyrics);

    await prisma.song.update({
      where: { id: songId },
      data: {
        lyrics: validatedLyrics,
        youtubeId: data.youtubeId,
      },
    });

    revalidatePath("/");
    revalidatePath(`/songs/${songId}`);
    revalidatePath(`/admin/edit/${songId}`);

    return { success: true };
  } catch (error) {
    console.error("Failed to save song data:", error);
    return { success: false, error: "데이터 검증 또는 저장에 실패했습니다." };
  }
}
