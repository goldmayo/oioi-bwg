import { check, sleep } from "k6";
import http from "k6/http";

import { getRandomSlug } from "./common.js";

export const options = {
  stages: [
    { duration: "10s", target: 10 }, // 평상시 부하
    { duration: "10s", target: 200 }, // 10초 만에 200명으로 폭증
    { duration: "1m", target: 200 }, // 폭증 상태 유지
    { duration: "10s", target: 10 }, // 다시 급격히 감소
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    // 스파이크 상황에서는 에러가 발생하더라도 시스템이 복구되는지가 중요합니다.
    http_req_failed: ["rate<0.1"], // 에러율 10% 미만 목표
  },
};

export default function spike_scenarios() {
  const BASE_URL = __ENV.BASE_URL || "https://staging.oioibawige.com";

  // 실제 DB 조회를 유도하기 위해 랜덤 페이지 접속
  const slug = getRandomSlug();
  const res = http.get(`${BASE_URL}/songs/${slug}?t=${Date.now()}`, {
    tags: { name: "Song_Detail" },
  });

  check(res, {
    "status is 200": (r) => r.status === 200,
  });

  sleep(1);
}
