# Web 관리·가입 종료의 배포와 복구 경계

이 절차는 [P06 계획의 안전한 rollback](../../docs/migration/implementation/console-guide-editor/P06-PLAN.md#web-관리-종료-이후의-안전한-rollback)을 구현한다.
코드와 로컬 검증 준비이며 실제 VM 적용 기록은 아니다. C/D의 실제 Console 운영 검증 완료 후 E Promotion에 적용한다.

## 적용 전

- 기존 Web은 host loopback 3000에만 publish하고, 외부 접근은 확인한 Caddy hostname을 거쳐야 한다.
  별도 공개 origin 또는 우회 포트가 있으면 먼저 차단한다.
- 현재 Caddy 설정과 두 앱 candidate/env 복구본을 보호된 경로에 보관한다.
  Console의 외부 차단·등록 false와 MFA 키/버전은 유지한다.
- [web-retirement.caddy](web-retirement.caddy)를 root 소유, 그룹/기타 쓰기 불가인 host 파일로 설치한다.
  앱 image/env 또는 paired release 디렉터리에 넣지 않는다.
- 각 Web hostname의 기존 `route`에서 reverse_proxy **앞**에 이 파일을 import한다.
  기존 hostname/TLS/CDN 설정과 Console route를 추측해서 덮어쓰지 않는다.

```caddyfile
# 기존 Web site 안의 배치 예시. 전체 Caddyfile을 대체하는 파일이 아니다.
route {
    import /etc/caddy/web-retirement.caddy
    reverse_proxy 127.0.0.1:3000
}
```

Caddy의 [route 순서 보존](https://caddyserver.com/docs/caddyfile/directives/route)과
[request matcher](https://caddyserver.com/docs/caddyfile/matchers) 규칙을 사용한다.
실제 전체 설정을 `caddy validate`한 뒤 검토한 변경으로 reload한다.
HTTP hostname도 같은 차단을 적용하거나 HTTPS로만 redirect하는지 확인한다.

## E 적용·rollback 공통 불변 조건

- Web 관리·가입 URL은 403이다. 새 Web에 직접 도달한 제거된 관리 route는 404다.
- 모든 `Next-Action` 요청은 URL과 관계없이 host에서 403이다.
  새 Next16.4.1 Web에 직접 보낸 이전의 정상 형식 Action ID는409와
  `x-nextjs-action-not-found: 1`·`Server Action unavailable.`로 거절한다. 이를 관리 route의404와 구분한다.
  헤더 없는 multipart `$ACTION_ID_...` form도 GET/HEAD 외 요청 차단으로 거부한다.
- 현재 Web에서 허용하는 쓰기는 Auth.js의 `POST /api/auth/callback/credentials`와
  `POST /api/auth/signout` 두 경로뿐이다. 이 경로의 인증/CSRF 검증은 Auth.js가 유지한다.
  새 Web 로그인 UI는 Auth.js HTTP 흐름을 사용하므로 Server Action 허용 예외가 필요하지 않다.
- 조회·정적 파일·Auth.js CSRF/session GET은 유지한다.
  향후 Web 사용자 mutation 추가 시 이 허용 목록을 같은 변경에서 명시적으로 검토해야 한다.
- 과거 이미지에서도 외부에서 관리 API/Action과 가입 POST가 upstream에 도달하지 않아야 한다.
  이미지/env rollback이 이 host 파일 또는 Caddy 접근 제한을 복구본으로 덮어쓰면 안 된다.

E 배포 전에 위 조건을 실제 hostname에서 확인하고, 새 candidate와 안전한 previous pair 각각에서
일반 Credentials 로그인/로그아웃·공개 조회 및 차단 요청을 검증한다.
과거 Web에는 /login 화면이 없을 수 있으므로 복구 시 일반 로그인은 기존 Auth.js /api/auth/signin으로 확인한다.
차단 경계가 실제 검증되지 않은 previous pair는 E 이후 자동 rollback 대상으로 승인하지 않는다.
경계 hash/권한/동작이 달라졌거나 안전한 pair가 없으면 maintenance를 유지하고 수동 복구한다.

## 로컬 재현과 한계

`node tests/ops/web-retirement-proxy-smoke.mjs`는 digest로 고정한 공식 Caddy 2.10.2 이미지에서
바이너리를 추출하여 WSL/CI 프로세스와 같은 localhost에서 실행한다. Docker Desktop의 별도 VM에
host network를 붙여 같은 localhost라고 가정하지 않는다. 동적 임시 포트와 가짜 이전 upstream을 사용하고
종료 시 프로세스·생성한 container·파일을 정리한다. VM 또는 운영 DB에 연결하지 않는다.

이 검사는 관리/가입/임의 Action 요청이 이전 upstream에 도달하지 않음과 일반 인증/조회 통과를 증명한다.
`test:integration:admin`은 새 Web의 일반 로그인·실제 이전 upload Action ID 거부와
Console CRUD·회수·공개 Web 조회를 격리 DB/브라우저에서 검증한다.
실제 host 설치·공개 hostname·paired rollback 실증은 별도 운영 증거가 필요하다.
