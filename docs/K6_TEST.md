# 부하 테스트(Load Test) 가이드

이 문서는 프로젝트의 성능 검증을 위한 k6 부하 테스트 방법을 설명합니다.

> **참고**: 로컬 에뮬레이터(`wrangler dev`) 환경은 리소스 제한으로 인해 동시 접속자 10명 이상의 테스트에서 `ECONNRESET`이 발생할 수 있습니다. 정확한 성능 측정은 배포된 Staging/Production 환경을 대상으로 진행하는 것을 권장합니다.

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
