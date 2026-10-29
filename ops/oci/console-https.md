# Console HTTPS 지속 공개 운영

정책과 실행 범위는 [P06 계획의 회사 검증용 공개 개정](https://github.com/goldmayo/oioi-bwg/blob/e93ae610169e4ce0e9b7f1a75a9a02cbf179d46f/docs/migration/implementation/console-guide-editor/P06-PLAN.md#2026-10-21-회사-검증용-console-공개-유지-개정)이 소유한다.
실제 실행 증거와 남은 인증 검증은 [P06-C 결과](../../docs/migration/implementation/console-guide-editor/P06-C-RESULT.md)에 기록한다.
이 문서는 새 호스트에 즉시 실행하는 설치 스크립트가 아니다. 실제 파일·배포 상태를 대조한 운영 변경 절차다.

## 배포와 접근 개방 순서

1. 두 앱 digest, 정상 receipt, current/previous pair, runtime env와 snapshot 일치,
   container ID/configHash, Caddy 파일·실행 설정·인증서, 보호 백업과 배포 lock/pending 상태를 확인한다.
   원본 public env·materializer·Caddy 조각은 root 소유 보호 백업에 보존한다.
2. 배포 lock 아래 검토한 HTTPS 지원 materializer를 설치하고 protected public env의 Console Origin을
   `https://console.oioibawige.com`으로 설정한다. enrollment는 false를 유지한다.
   기존 runtime env와 과거 snapshot·receipt는 직접 수정하지 않는다. 비밀값을 로그에 남기지 않는다.
3. 정상 `migration_main → migration_develop` Promotion에서 검증한 동일 candidate를 배포한다.
   새 snapshot·runtime env의 HTTPS Origin, enrollment=false와 두 앱 health/readiness를 확인한다.
   실패하면 배포의 runtime 복구 결과를 확인하고 준비 단계의 public env·materializer source도 복원한다.
   불명확한 pending 상태에서 새 배포를 시도하지 않는다.
4. 기존 preview·인증서 발급 설정을 보존한 Console Caddy 조각을 validate 후 원자적으로 적용하고 reload한다.
   [기본 조각](console.Caddyfile)의 전역403은 이 승인된 적용에서만 제거한다.
   Cloudflare 연결 peer만 upstream으로 허용하고 직접 origin 요청은403으로 거절한다.
   P08 Runner 활성화 전에는 공개 proxy의 `/api/internal`·`/api/internal/*` 404 차단을 유지한다.
   차단은 `console_upstream` snippet 안에 있어 공개 전역403을 제거해도 남는다. Runner는 VM loopback으로만
   내부 API에 접근한다. 기존 운영 Caddy 파일의 해당 조각 변경·validate/reload와 외부 차단 검증은 별도 승인 범위다.
   Host·X-Forwarded-Host·Proto를 고정하고, 전달 client IP는 신뢰한 CF-Connecting-IP로 덮어쓴다.
   외부 X-Real-IP·Forwarded·CF-Connecting-IP와 과거 검증용 헤더를 upstream에 그대로 전달하지 않는다.
   no-store·Cloudflare cache bypass·로그인 GET Managed Challenge를 유지한다.
5. 실제 IP 전달·위조 헤더 방어·직접 origin 차단·Origin 거절·익명 관리 API와 등록 거절·두 앱 건강 상태를 검증한다.
   일시적인 IP 진단 응답 헤더나 token은 제거한 최종 설정으로 다시 검증한다.
   검증 완료 후 적용 작업의 lock을 해제하고, 일반 브라우저에서 로그인할 주소를 즉시 안내한다.

## 성공한 공개 상태의 수명

공개 성공 후에는 별도 종료 timer, RuntimeMaxSec, ExecStopPost, 무조건적인 finally 원복을 두지 않는다.
개별 적용 명령의 timeout과 적용 실패 시 복구는 필요하지만 성공한 서비스의 공개 기간을 제한하지 않는다.
사용자 회신 대기·채팅 종료·자동 검사 완료·정상적인401/403은 서비스 종료 조건이 아니다.
Caddy reload와 Console 재생성 후에도 HTTPS 설정을 확인하며, 후속 Promotion은 같은 protected source에서 생성한다.

실제 인증 검증은 비밀번호·실물 OTP 로그인, 관리 조회, host-only Secure/HttpOnly/Lax session cookie,
preview로 cookie가 전달되지 않음, 로그아웃 후 접근 거절을 포함한다. 자동 검사만으로 완료 처리하지 않는다.
회신 전 상태는 **공개 유지 / 인증 확인 대기**다. 관리자 가입·공개 MFA 등록은 허용하지 않는다.

## 중단과 복구

사용자 종료 지시, 확인된 인증·인가·IP·Origin 경계 훼손이나 비밀 유출, 지속적인 건강 상태 실패,
설정 적용 실패가 있으면 Console을 닫고 검증한 상태로 복구한 뒤 원인과 결과를 알린다.
최초 HTTPS 전환의 previous pair가 HTTP이면 그 복구는 공개 유지 가능한 복구가 아니다.
closed403으로 안전하게 복구하고 실제 상태를 보고한다. 과거 snapshot을 HTTPS로 고쳐 쓰지 않는다.

D의 reset·재등록은 사용자가 SSH loopback과 실물 인증기를 사용할 수 있을 때 안내된 비공개 절차로 수행한다.
완료 후 HTTPS 공개로 복귀한다. E의 Web 관리·가입 종료는 D 검증 뒤 별도 Promotion으로 적용한다.
F의 www 전환·Worker/staging/preview 종료는 이 절차에 포함하지 않는다.
