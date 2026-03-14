import { check, group, sleep } from "k6";
import http from "k6/http";
import { Rate, Trend } from "k6/metrics";

import { getRandomSlug } from "./common.js";

// 커스텀 지표 설정
const errorRate = new Rate("errors");
const pageTrend = new Trend("page_duration");

export const options = {
  // 테스트 단계 설정 (VUs: Virtual Users)
  stages: [
    { duration: "30s", target: 10 }, // Warm-up
    { duration: "1m", target: 20 }, // Load Test
    { duration: "30s", target: 0 }, // Cool-down
  ],
  // 성공 기준 (임계치)
  thresholds: {
    // 1. HTTP 에러율: 전체 요청의 1% 미만 (안정성)
    http_req_failed: ["rate<0.01"],

    // 2. 응답 속도(P95): 95%의 사용자가 500ms 이내 응답 (사용자 경험)
    http_req_duration: ["p(95)<500"],

    // 3. 응답 속도(P99): 가장 느린 1%의 사용자도 1초 이내
    "http_req_duration{p(99):<1000}": ["p(99)<1000"],

    // 4. 처리량: 테스트 기간 동안 최소 50건 이상의 요청 처리
    http_reqs: ["count>50"],
  },
};

export default function load_scenarios() {
  const BASE_URL = __ENV.BASE_URL || "https://staging.oioibawige.com";

  // 1. 메인 페이지 접속
  group("01. Browse Home", function () {
    const res = http.get(`${BASE_URL}/`);
    const isOk = check(res, {
      "home status is 200": (r) => r.status === 200,
      "home has content": (r) => r.body.length > 0,
    });

    pageTrend.add(res.timings.duration);
    errorRate.add(!isOk);

    // 사용자 행동 모사를 위한 대기 (1~2초)
    sleep(Math.random() * 1 + 1);
  });

  // 2. 랜덤 가사 페이지 조회
  group("02. View Lyrics Detail", function () {
    const slug = getRandomSlug();
    const res = http.get(`${BASE_URL}/songs/${slug}`);

    const isOk = check(res, {
      "song status is 200": (r) => r.status === 200,
      "song body is valid": (r) => r.body.includes("lyrics") || r.body.length > 500,
    });

    if (isOk) pageTrend.add(res.timings.duration);
    errorRate.add(!isOk);

    // 가사를 읽는 시간 모사 (2~4초)
    sleep(Math.random() * 2 + 2);
  });
}
