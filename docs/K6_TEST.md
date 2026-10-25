# 부하 테스트(Load Test) 가이드

이 문서는 공개 Web의 수동 외부 성능 검증을 위한 k6 도구 안내입니다. 앱 import나 unit 환경이 없고
root의 test:load/stress/spike가 실행 진입점을 소유하므로 tests/k6에 유지합니다. 일반 unit/verify는 실행하지 않습니다.
기존 script의 외부 기본 target은 실행 전 별도로 확인·승인해야 하며 이번 정상화에서는 호출하지 않았습니다.
이름에 staging이 있는 기존 hostname은 APP_ENV 값이나 별도 staging 운영을 뜻하지 않습니다.
대상·이름은 자동 변경하지 않으며 로컬 앱 환경은 local, VM 앱 환경은 production입니다.

2026-10-23 정정: 이전 Wrangler dev의 10명 초과 ECONNRESET 설명은 과거 Worker 앱 관측 이력입니다.
현재 제품 앱은 Next standalone이며 이 관측을 현재 로컬 성능 근거나 staging 운영 전제로 사용하지 않습니다.
독립 Sentry relay는 이 부하 테스트의 대상이 아닙니다.

## 1. k6 설치

- **Linux (ARM64/WSL2)**:
  ```bash
  curl -L https://github.com/grafana/k6/releases/download/v0.50.0/k6-v0.50.0-linux-arm64.tar.gz | tar xvz
  sudo mv k6-v0.50.0-linux-arm64/k6 /usr/local/bin/
  ```
- **macOS**: `brew install k6`

## 2. 테스트 시나리오

```text
cheer-rock-crab/
├── tests/
│   └── k6/
│       ├── common.js  # 공용 상수 및 함수
│       ├── load.js    # load 테스트 시나리오
│       ├── spike.js   # spike 테스트 시나리오
│       └── stress.js  # stress 테스트 시나리오
```

## 3. 실행 방법

배포된 서버 주소를 인자로 주어 실행합니다.

```bash

#npx K6_WEB_DASHBOARD=true k6 run -e BASE_URL=https://staging.oioibawige.com tests/k6/*.js

pnpm test:load
pnpm test:spike
pnpm test:stress
```
