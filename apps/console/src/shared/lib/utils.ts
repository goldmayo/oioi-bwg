import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 범용 디바운스 함수 (타입 안정성 강화 버전)
 */
export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  delay: number,
): (...args: Args) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Args) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      fn(...args);
    }, delay);
  };
}

/** 날짜 계약의 calendar day를 보존한다. 브라우저 시간대로 전날로 이동시키지 않는다. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const date = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:T|$)/.exec(value);
  if (!date) return "-";
  return `${date[1]}.${date[2]!.padStart(2, "0")}.${date[3]!.padStart(2, "0")}`;
}
