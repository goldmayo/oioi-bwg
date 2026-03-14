import { check, sleep } from "k6";
import http from "k6/http";

export const options = {
  stages: [
    { duration: "2m", target: 50 }, // 50명까지 완만하게 상승
    { duration: "3m", target: 50 }, // 유지하며 안정성 확인
    { duration: "2m", target: 100 }, // 100명까지 상승 (한계 지점 탐색)
    { duration: "3m", target: 100 }, // 유지
    { duration: "2m", target: 200 }, // 200명까지 상승 (시스템 붕괴 유도)
    { duration: "3m", target: 0 }, // 정리
  ],
  thresholds: {
    http_req_duration: ["p(95)<1000"], // 95% 요청은 1초 이내
    http_req_failed: ["rate<0.05"], // 에러율 5% 미만 유지
  },
};

export default function stress_scenarios() {
  const BASE_URL = __ENV.BASE_URL || "https://staging.oioibawige.com";

  // 캐시 우회를 위해 타임스탬프 파라미터 추가
  const res = http.get(`${BASE_URL}/?t=${Date.now()}`);

  check(res, {
    "status is 200": (r) => r.status === 200,
  });

  sleep(1);
}
