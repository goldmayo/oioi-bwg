# 부하 테스트(Load Test) 가이드

이 문서는 `cheer-rock-crab` 프로젝트의 성능 검증을 위한 k6 부하 테스트 방법을 설명합니다. 

> **참고**: 로컬 에뮬레이터(`wrangler dev`) 환경은 리소스 제한으로 인해 동시 접속자 10명 이상의 테스트에서 `ECONNRESET`이 발생할 수 있습니다. 정확한 성능 측정은 배포된 Staging/Production 환경을 대상으로 진행하는 것을 권장합니다.

## 1. k6 설치

- **Linux (ARM64/WSL2)**:
  ```bash
  curl -L https://github.com/grafana/k6/releases/download/v0.50.0/k6-v0.50.0-linux-arm64.tar.gz | tar xvz
  sudo mv k6-v0.50.0-linux-arm64/k6 /usr/local/bin/
  ```
- **macOS**: `brew install k6`

## 2. 테스트 시나리오 (`scenarios.js`)

아래 코드를 `scenarios.js`로 저장하여 사용하세요.

```javascript
import { check, group, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";
import http from "k6/http";

const errorRate = new Rate("errors");
const lyricsPageTrend = new Trend("lyrics_page_duration");

export const options = {
  stages: [
    { duration: "1m", target: 20 },
    { duration: "3m", target: 20 },
    { duration: "1m", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"],
    lyrics_page_duration: ["p(95)<300"],
    http_req_failed: ["rate<0.01"],
  },
};

export default function testScenario() {
  const BASE_URL = __ENV.BASE_URL || "https://your-deployed-url.com";

  group("Browse Home", function () {
    const res = http.get(`${BASE_URL}/`);
    const isOk = check(res, { "status is 200": (r) => r.status === 200 });
    errorRate.add(!isOk);
    sleep(Math.random() * 2 + 1);
  });

  group("View Lyrics", function () {
    const slugs = ["t-b-h", "discord", "manito", "harmony-of-stars"];
    const slug = slugs[Math.floor(Math.random() * slugs.length)];
    const res = http.get(`${BASE_URL}/songs/${slug}`);

    const isOk = check(res, {
      "status is 200": (r) => r.status === 200,
      "content length > 0": (r) => r.body && r.body.length > 0,
    });

    if (isOk) lyricsPageTrend.add(res.timings.duration);
    errorRate.add(!isOk);
    sleep(Math.random() * 3 + 2);
  });
}
```

## 3. 실행 방법

배포된 서버 주소를 인자로 주어 실행합니다.
```bash
k6 run -e BASE_URL=https://staging.oioibawige.com scenarios.js
```

## 4. 인프라 구성 참고 (로컬 테스트 시)
로컬에서 테스트가 필요한 경우, `postgres:16`, `influxdb:1.8`, `grafana/grafana` 컨테이너를 포함하는 Docker Compose 환경이 필요합니다. 상세 설정은 프로젝트 이력을 참고하세요.
