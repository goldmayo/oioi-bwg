# 사용자 웹 홈 이미지 캐러셀 CMS 계획

작성일: 2026-11-24. 분류: 여러 PR의 기능 구현 계획. 상태: **계획 제안·미구현**.
사용자 요청은 사용자 웹 이미지 캐러셀을 하드코딩하지 않고 Console에서 관리하는 것이다.
노출 위치가 지정되지 않아 **홈(`/`)의 소개 영역과 앨범 목록 사이 한 곳**을 기준으로 제안한다.
아래의 신규 콘텐츠·권한·공개 정책은 현행 계약이 아니며 첫 구현 PR에서 Domain에 반영한다.

## 1. 목표와 범위

운영자는 코드 수정·재배포 없이 이미지 추가·교체·삭제, 설명·링크 입력, 노출 순서와 공개 대상을
관리한다. 편집 중 내용과 현재 공개본을 분리하고, 공개 반영은 캐러셀 전체를 한 번에 교체한다.
웹 방문자는 공개본만 보고 이미지에 연결된 안내나 콘텐츠로 이동한다. 앨범·응원법 탐색을 가리지 않는다.

| 구분 | 1차 제안 |
| --- | --- |
| 관리 위치 | Console `/admin/home-carousel`, 메뉴 이름 `홈 이미지 관리` |
| 관리 콘텐츠 | 이미지, 관리용 이름, 대체 텍스트, 선택적 이동 링크, 순서, 공개 포함 여부 |
| 운영 흐름 | 편집 → 초안 저장 → 공개 미리보기 → 공개 반영; 현재 공개본과 초안 비교 |
| 숨김·삭제 | 항목 제외·삭제는 초안에 저장 후 공개 반영; `전체 숨김`은 공개본만 비우고 초안 보존 |
| 개수 | 초안 전체 최대 10개 제안. 공개 0개면 영역 생략, 1개면 단일 이미지, 2개 이상이면 캐러셀 |
| 이미지 | 우선 항목당 공통 이미지 1장. AVIF/JPEG/PNG/WebP, 파일당 최대 5MiB 제안 |
| 인터랙션 | 이전·다음 버튼, 현재 위치 표시, 모바일 스와이프. 자동 넘김은 1차에서 사용하지 않음 |

예약 공개·종료, 모바일 전용 이미지, 이미지 편집기, 다국어 콘텐츠, 클릭 통계, 승인 역할 분리,
과거 공개본 복원 이력, 범용 페이지 빌더·외부 CMS 제품 도입은 후속 요구로 둔다.
운영 콘텐츠와 별개인 배치·반응형·모션·컴포넌트 설정은 코드가 소유한다.

## 2. 확인한 현재 구조와 근거

코드 기준은 최신 원격 `main@6ca887ea88e041f18c5d89e4b459d8d8e7ab563c`이며 착수 시 작업 트리는 깨끗했다.
로컬 `main@12c3d4bf4e5966ff28854713260601b67eb0f02a`보다 원격이 6커밋 앞서 있어 원격에서 계획 브랜치를 만들었다.
다음은 파일을 읽어 확인한 사실이며 운영 DB·R2·실제 화면을 재조회한 결과가 아니다.

- [홈 원본](https://github.com/goldmayo/oioi-bwg/blob/6ca887ea88e041f18c5d89e4b459d8d8e7ab563c/apps/web/src/app/%28user%29/page.tsx): 소개와 앨범 목록이며 캐러셀 없음. `force-dynamic`, RSC → service 직접 조회 사용.
- [Console 메뉴](https://github.com/goldmayo/oioi-bwg/blob/6ca887ea88e041f18c5d89e4b459d8d8e7ab563c/apps/console/src/app/%28admin%29/admin/_config/admin-navigation.ts): 앨범·곡·응원법·알림 관리가 있으며 캐러셀 메뉴 없음.
- [현재 콘텐츠 테이블](https://github.com/goldmayo/oioi-bwg/blob/6ca887ea88e041f18c5d89e4b459d8d8e7ab563c/packages/server/src/db/schema.ts): 공지·업데이트와 약관은 DB 기반이나 캐러셀은 없음.
  [Domain §34·35](../DOMAIN_SPECIFICATION.md#34-서비스-공지와-업데이트-2026-10-26)는 이들 콘텐츠의 공개 조회를 규정한다. 캐러셀을 공지 종류로 끼워 넣지 않는다.
- [앨범 업로드](https://github.com/goldmayo/oioi-bwg/blob/6ca887ea88e041f18c5d89e4b459d8d8e7ab563c/packages/server/src/services/album-image-service.ts)는 관리자 권한과 파일 크기·MIME을 검사한다.
  현재 전달 어댑터는 Console의 route-private Server Action이다. 캐러셀의 새 기본 transport로 복제하지 않는다.
- [공용 업로드](https://github.com/goldmayo/oioi-bwg/blob/6ca887ea88e041f18c5d89e4b459d8d8e7ab563c/packages/server/src/storage/upload-public-asset.ts)는 서버에서 R2에 저장하고 canonical URL을 돌려준다.
  UUID object key와 immutable 캐시를 사용한다. [기존 결과](M5-R2-ADMIN-IMAGE-UPLOAD-RESULT.md)는 과거 검증 근거다.

적용 기준은 [헌법](../oioi-bwg-architecture-clean-v1/01-architecture-constitution.md),
[Frontend](../oioi-bwg-architecture-clean-v1/02-frontend-architecture.md),
[API/Error](../oioi-bwg-architecture-clean-v1/03-api-error-architecture.md),
[Auth/Authz](../oioi-bwg-architecture-clean-v1/04-auth-authz-architecture.md),
[Contract](../oioi-bwg-architecture-clean-v1/05-contract-validation-architecture.md),
[Server/Data](../oioi-bwg-architecture-clean-v1/06-server-data-access-architecture.md),
[Rendering/Query](../oioi-bwg-architecture-clean-v1/07-rendering-query-cache-architecture.md),
[Assets](../oioi-bwg-architecture-clean-v1/11-content-i18n-assets-runtime-architecture.md)다.
화면 문구·검수는 [PHILOSOPHY](../../PHILOSOPHY.md)와 [DESIGN](../../DESIGN.md)을 따른다.

## 3. 콘텐츠와 공개 계약 제안

첫 PR에서 Domain에 `HomeCarousel`과 항목, ADMIN의 관리·공개 권한, 아래 상태와 불변 조건을 명시한다.
응원법의 Revision·승인 절차와 분리된 서비스 운영 콘텐츠로 정의한다.

- 신규 항목은 공개 포함 여부가 꺼진 상태로 시작한다. 관리용 이름과 대체 텍스트는 공백만 허용하지 않는다.
- `초안 저장`은 DB의 초안만 바꾼다. 이미지·순서·링크·포함 여부 변경과 삭제 모두 현재 공개본에 영향을 주지 않는다.
- `공개 반영`은 **저장된 초안 중 공개 대상으로 선택한 항목**을 순서 그대로 공개본에 복사한다.
  미저장 입력이 있으면 먼저 저장하도록 안내하고, 공개본과 새 공개 대상·순서를 확인한 뒤 반영한다.
- 전체 숨김은 공개본을 빈 목록으로 바꾸며 저장된 초안은 유지한다. 저장 실패·충돌을 공개 성공으로 표시하지 않는다.
- 링크는 없을 수 있다. 내부 경로 또는 정상적인 HTTPS URL만 허용한다. 내부 경로의 `//`·역슬래시 우회,
  실행 스킴·사용자정보 포함 URL을 거절한다. 1차는 같은 탭에서 이동하며 HTML·임의 스크립트를 받지 않는다.
- 공개 DTO는 이미지·대체 텍스트·이동 링크·항목 ID만 포함한다. 관리용 이름·초안·잠금 버전·행위자 정보는 제외한다.
- 공개·저장·전체 숨김 모두 읽었던 버전을 검사한다. 다른 관리자의 저장이나 공개를 자동 덮어쓰지 않는다.

## 4. 저장 모델과 동시성

최대 10개를 한 번에 편집·공개하는 단일 구성에 맞춰 `home_carousel` 한 행의 문서형 모델을 제안한다.
개별 항목 검색·페이지 이동·통계를 요구하지 않으므로 항목 테이블과 범용 CMS framework를 선행 도입하지 않는다.

| 필드 | 제안과 책임 |
| --- | --- |
| `id` | 기존 application UUIDv7 생성 방식의 PK. 새 PostgreSQL 확장 도입 없음 |
| `placement` | `home`만 허용하는 고유 키. 다중 배치 관리 UI는 제공하지 않음 |
| `draft_slides` | 순서 있는 JSONB 배열. 항목 ID, 관리용 이름, 이미지 URL·치수, alt, 링크, 공개 포함 여부 |
| `published_slides` | 공개 projection만 담는 JSONB 배열. 저장된 초안과 독립된 복사본 |
| `lock_version` | 양의 정수. 저장·공개·전체 숨김마다 증가하는 캐러셀 전체의 낙관적 잠금 버전 |
| `created_at`, `updated_at`, `published_at` | timestamptz. 마지막 공개 반영 시각과 저장 시각을 구분 |

배열 순서가 표시 순서다. 별도 `sort_order`와 이중 관리하지 않는다. 항목 ID는 서버에서 UUIDv7로
발급하며 순서 변경·이미지 교체에도 유지한다. 새 입력의 ID는 생략하고 저장 응답에서 확정한다.
DB CHECK는 배열 타입·최대 개수·버전 등 구조를 보호하고, Zod는 중복 ID·필드·URL·이미지 메타데이터를 검증한다.
placement 고유 인덱스 외에 JSONB 검색용 인덱스를 만들 이유는 현재 없다.

초기 행이 없으면 관리 조회는 버전 0의 빈 구성, 공개 조회는 빈 목록을 돌려준다.
첫 초안 저장의 조건부 INSERT로 행을 만든다. 동시 최초 저장은 하나만 성공하고 나머지는 충돌 처리한다.
기존 행은 `WHERE placement = 'home' AND lock_version = expectedVersion` 조건부 UPDATE를 사용한다.
공개 반영은 같은 UPDATE에서 저장된 초안을 공개 projection으로 복사하고 버전을 증가시킨다.
영향 행 0개는 `HOME_CAROUSEL_CONFLICT`로 처리한다. 단일 SQL mutation에 별도 transaction을 강제하지 않는다.
공개본 읽기도 한 행에서 수행해 이미지와 순서가 서로 다른 버전으로 섞이지 않게 한다.

이 조건부 갱신은 [PostgreSQL 17의 UPDATE 조건 재평가](https://www.postgresql.org/docs/17/transaction-iso.html#XACT-READ-COMMITTED)를 전제로 한다.
R2 호출·파일 읽기를 DB 잠금 안에 넣지 않는다. 실제 동시 요청 검증은 로컬 PostgreSQL에서 수행한다.

## 5. 업로드와 에셋 수명

- 기존 `uploadPublicAsset`만 재사용하고 캐러셀 전용 업로드 service를 둔다. 앨범 service·Action을 호출하지 않는다.
- Console에서 인증·MFA·Origin을 먼저 검사한 multipart Route Handler로 업로드한다. 파일 크기와 요청 본문 상한을
  함께 적용하며 프록시 제한도 확인한다. MIME 문자열뿐 아니라 실제 포맷·헤더의 치수·빈 파일도 검증한다.
- 공개 자산 경로는 `images/home-carousel/{uuid}.{extension}` 제안. 교체 시 새 키를 발급하며 기존 URL을 덮어쓰지 않는다.
  응답은 canonical URL과 검증한 width/height다. Web에 R2 쓰기 credential을 제공하지 않는다.
- 초안 입력의 이미지 URL도 허용한 canonical host·전용 경로를 검증한다. 외부 이미지 URL을 서버에서 대신 가져오지 않는다.
- 업로드 성공은 초안 저장·공개 성공과 별개다. 저장 실패나 취소 후 남은 object와 이전 이미지를 즉시 삭제하지 않는다.
  현재 공개본·초안 참조를 확인하는 orphan 정리는 별도 작업이며, 미제공 상태와 수동 확인 범위를 운영 안내에 남긴다.
- **공개 R2의 이미지 URL 자체는 비공개 초안 보관소가 아니다.** 초안 비노출은 웹의 목록·메타데이터 계약이다.
  공개 전 비밀 이미지의 보관 요구가 있으면 private storage·전달 설계부터 별도로 변경해야 한다.

## 6. 애플리케이션 경계와 API

```text
Console: RHF 편집 → TanStack Query mutation → ky → Console Route Handler
                                                     ↓
                                             공통 service → repository → PostgreSQL
Web: 홈 RSC → 공통 공개 조회 service → 공개 DTO → route-private 캐러셀 UI
Upload: Console Route Handler → 전용 image service → 기존 R2 storage adapter
```

| 경계 | 구현 위치 제안 |
| --- | --- |
| serializable 요청·응답 | `packages/contracts/src/home-carousel.ts`, 명시적 package export |
| persistence·use case | `packages/server/src/repositories/home-carousel-repository.ts`, `services/home-carousel-service.ts` |
| 파일 검증·업로드 | `packages/server/src/services/home-carousel-image-service.ts`; File 자체는 공용 HTTP DTO에 넣지 않음 |
| Console HTTP | `/api/admin/home-carousel` GET, `/draft` PUT, `/publish` POST, `/unpublish` POST, `/images` POST |
| Console 화면 | `/admin/home-carousel`의 `_ui`·`_model`; 메뉴·경로·breadcrumb 등록 |
| Console browser API | `entities/home-carousel/api`의 adapter·queryOptions·mutationOptions와 public API |
| 공개 UI | `apps/web/src/app/(user)/_ui/home-carousel.tsx`와 필요한 route-private 상태 |

관리 API는 현재 ACTIVE ADMIN·MFA guard와 service의 CASL 검사를 모두 적용한다. mutation은 Origin도 검사한다.
JSON 입력은 Route Handler에서 한 번 검증하고 중요한 출력은 DTO로 검증한다. 파일의 실제 검증은 서버 업로드 경계가 소유한다.
성공은 직접 DTO, 실패는 기존 `{code, message}` 계약을 따른다. 충돌은 409, 인증·권한 거절은 기존 401/403,
입력·크기 오류는 400/413, 저장 데이터·출력 계약 위반은 500/관측 대상으로 구분한다.

Console의 캐러셀 조회·현재 공개본은 Query가 소유하고 mutation 성공 후 동일 관리 queryKey를 invalidate한다.
입력·순서 변경은 RHF draft가 소유한다. 재조회·409가 발생해도 편집 중인 값을 무조건 reset하지 않는다.
충돌 시 최신 구성 확인과 초안 재적용을 안내하며 저장 요청을 자동 재시도하지 않는다.

Web은 공개본을 초기 요청에서만 읽고, 슬라이드 이동은 순수 UI state로 처리한다.
1차에는 공개 API·Query polling을 추가하지 않는다. **공개 반영 후 새로운 서버 요청·전체 새로고침에서 최신본을 제공**하며
이미 열린 탭이나 브라우저에 보존된 route의 즉시 교체는 보장하지 않는다. 필요해지면 공개 Query 수명과 갱신 경로를 별도 설계한다.
Next Data Cache·태그 무효화와 앱 사이 cache invalidation 통신을 추가하지 않는다.

## 7. 화면과 접근성 검증 계획

Console은 썸네일·관리용 이름·공개 포함 여부를 일정한 위치에서 비교할 수 있게 구성한다.
위/아래 이동 버튼으로 키보드 순서를 지원한다. 드래그는 필요할 때 보조 수단으로 추가한다.
초안과 실제 공개본을 명확히 표시하고, 업로드 중·미저장·저장 중·공개 중·충돌·실패를 구분한다.
미리보기는 모바일·데스크톱 폭에서 실제 이미지와 대체 텍스트·링크를 확인하도록 한다.

공개 UI는 빈 목록에서 여백까지 제거하고, 한 장일 때 이동 컨트롤을 생략한다.
여러 장에서는 버튼 이름·현재 순서·포커스 유지·스와이프와 세로 스크롤의 충돌을 확인한다.
숨겨진 슬라이드의 링크가 Tab 순서나 보조기술 탐색에 남지 않게 한다.
수동 이동·슬라이드 의미는 [WAI-ARIA 캐러셀 패턴](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/)을 참고한다.
자동 넘김을 나중에 채택하면 정지/재생과 focus·hover 정지 규칙도 함께 구현한다.

첫 이미지에만 우선 로딩을 검토하고 나머지는 지연 로딩한다. width/height와 비율 공간을 확보한다.
첫 UI PR에서 실제 제공 이미지로 모바일·데스크톱의 비율·크롭·높이와 원본 해상도를 확정한다.
이미지 속 글자가 잘리는 안은 채택하지 않는다. 기존 이미지 렌더링·remotePatterns를 확인한 뒤 구현 방식을 정한다.
390px·데스크톱, 다크·라이트, 긴 한글, 키보드·터치, reduced motion, 이미지 로딩 실패를 검수한다.
DB 장애·계약 위반을 정상 빈 목록이나 하드코딩 이미지로 바꾸지 않는다. 해당 영역의 실패를 표시·관측하고
앨범 목록은 사용할 수 있게 오류 경계를 분리한다. 현재 실제 화면·접근성·성능 판정은 **미확인**이다.

## 8. PR 순서와 완료 조건

| 순서 | reviewable concern | 완료 조건 |
| --- | --- | --- |
| 1 | Domain·DTO·persistence | 콘텐츠·권한·공개 계약 정합성, schema → migration 생성 → SQL 검토 → 명시적 로컬 적용. 초기 빈 상태·체크 제약 검증 |
| 2 | 조회·초안 저장 service | 공개/관리 projection 분리, 조건부 저장, 서버 ID 발급. 두 관리자·동시 최초 저장의 승자 1개 및 초안 보존 검증 |
| 3 | 공개·전체 숨김 service | 저장본만 원자 반영, 오래된 버전 거절, 공개와 저장 경합 검증. 숨김 후 초안·이미지 보존 |
| 4 | 이미지 업로드 HTTP | 권한·Origin·크기·실제 포맷 검증, R2 mock 검증. 직접 native 의존성이 필요하면 명시적 의존성과 ARM64 검증 포함 |
| 5 | 관리 API·browser adapter | GET/저장/공개/숨김 Route와 unknown 응답 parser, Query options. 실제 adapter 400/401/403/409/500·공개 정보 비노출 검증 |
| 6 | Console 편집 화면 | 메뉴·조회·이미지 추가/교체·RHF 편집·초안 저장·실패 복구. 관련 앱 build와 browser smoke |
| 7 | Console 공개·순서·미리보기 | 순서 조작·공개본 비교·공개 반영·전체 숨김·409 복구를 실제 HTTP로 검증. 키보드·390px 검수 |
| 8 | Web 연결과 통합 수용 | DB 공개본만 렌더. 0/1/다중·이미지 오류·링크·모션 감소 검증, 두 앱 사이 초안 비노출·반영·숨김 확인 |

기본 의존성은 1 → 2 → 3 → 5 → 6 → 7 → 8이며 4는 1 이후, 6 이전에 완료한다.
각 PR은 생성 파일·lockfile을 제외하고 20파일·400줄 이하를 목표로 한다. 초과 예상 시 HTTP 연결·회귀 등을 추가 분리한다.
여기에는 코드 PR의 실행 완료나 검증 성공을 기록하지 않는다. 개별 PR 본문이 실제 변경·실패·명령의 소유자다.

로컬 검증은 `pnpm verify --dry-run`으로 범위를 확인한 뒤 `pnpm verify`를 사용한다.
동시성은 mock만으로 판정하지 않고 Docker Compose PostgreSQL에서 확인한다. UI는 해당 앱 build/browser smoke를 추가한다.
Ready CI는 [Testing](../oioi-bwg-architecture-clean-v1/10-testing-architecture.md)와
[배포 runbook](../oioi-bwg-architecture-clean-v1/12-deployment-migration-runbook.md)을 따른다.
DB·인증·native 등 전체 검증 대상은 CI에서 수행하고 로컬에서 전체 CI를 반복하지 않는다.

새 migration은 캐러셀 구조만 추가하고 예시 이미지·운영 콘텐츠를 자동 주입하지 않는다.
운영 적용은 별도 main → production Promotion으로 진행하며 DB 변경은 명시적 승인·백업·검토 후 적용한다.
앱 rollback 시 추가 테이블·초안·공개본과 R2 object를 보존한다. 이전 앱은 캐러셀을 렌더하지 않아도 기존 홈을 사용할 수 있어야 한다.

## 9. 착수 전 확인과 문서 수명

홈의 제안 위치, 실제 등록 이미지, 공통 이미지의 모바일 크롭 가능 여부, 최대 10개·5MiB 제한은 제품 가정이다.
비율·크롭·해상도는 대표 이미지를 받은 첫 UI 설계에서 확정한다. 예약·자동 넘김·열린 탭 즉시 갱신 요구가 생기면
관련 데이터·상태·검증 범위를 먼저 개정한다. 이 계획은 그 요구가 이미 승인됐다는 근거가 아니다.

기존 공지·약관·편집기 문서는 이 기능의 책임을 소유하지 않고 여러 PR이 공개·동시성·업로드·통합 완료 조건을
공유해야 하므로 계획 파일 하나를 추가한다. 현재 상태·다음 행동은 [WORK](../../WORK.md) 한 곳에서 관리한다.
담당 구현자는 각 PR에서 계획 변경의 날짜·이유를 추적하고, 종료 시 이 관심사의 최종 결과와 PR 근거로 회수한다.
확정된 계약은 Domain·해당 active 문서, 반복 운영 절차는 기존 안내가 소유한다. 계획의 보존·통합·삭제는
[AGENTS §9](../../../AGENTS.md#9-문서-및-변경-원칙)에 따라 판단하며 PR마다 결과 파일을 늘리지 않는다.
