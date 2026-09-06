# M7-DATA-005

## Status

PLANNED

정책 결정 제안서 작성 완료. 사용자 정책 선택 전이며 구현 가능한 승인 계획은 아니다.
IMPLEMENT / REVIEW는 아직 시작하지 않았다. DATA-005 전체 완료 또는 VERIFIED를 뜻하지 않는다.

## PLAN

### Finding

Song.slug uniqueness policy. 스키마 누락 복구가 아니라 공개 식별자 정책 결정이다.
기준 커밋: `ca25046bcad0f1464fb77051a66ce2a838820a98`.
2026-09-06 fetch 후 local HEAD와 origin/migration_develop이 같은 것을 확인하고
`migration_m7-data-005-policy`로 분기했다. 시작 작업 트리는 깨끗했다.

### Selected Model / Effort

Registry 권고: POLICY DESIGN Astra High/Max, TECHNICAL PLAN Sol High,
IMPLEMENT 정책 결정 후 Sol High/Terra, FINAL REVIEW Astra 또는 Sol High.
실제 runtime model/effort는 이 기록에서 확인할 수 없어 추정하지 않는다. 모델 전환과 보조 agent 실행 없음.

### Confirmed Cause

- `docs/migration/implementation/M7-DATA-LAYER-ANALYSIS.md` DATA-005:
  legacy unique 선언은 baseline에서 의도적으로 제거됐다.
- `docs/migration/implementation/LOCAL-DEVELOPMENT-ENVIRONMENT.md`의 schema decision:
  Song_slug_key는 repo-only / production 미확인으로 분류됐다. migration 누락으로 복원하지 않는다.
- `.local/M7-POSTGRES-VERIFICATION.md` (2026-09-05, 기준 3b5743e):
  로컬 non-null 중복 그룹 0, unique 제약 없음, 격리 DB에서 같은 slug 두 행 insert 성공.
  이 파일은 Git 제외된 과거 로컬 증거이며 이번 작업에서 DB 검증을 재실행하지 않았다.
- 현재 `src/server/db/schema.ts`: Song.slug nullable, slug unique/index 없음.
- `src/server/repositories/song-repository.ts`: 공개/관리자 조회가 slug 조건의 findFirst.
  중복 시 단일 곡 identity를 보장하지 못한다. 공개 조회는 Song visibility를 먼저 필터하고
  service가 부모 Album visibility를 검사하므로 중복된 다른 공개 곡이 있어도 선택 행에 따라 404가 될 수 있다.
- `src/app/(user)/songs/[slug]/page.tsx`, `src/app/api/songs/[slug]/route.ts`,
  `src/app/(admin)/admin/edit/[slug]/page.tsx`, sitemap과 목록 링크는 slug 단독 주소를 사용한다.
- `src/shared/contracts/song.ts`: 관리자 입력은 trim 후 소문자 영숫자/하이픈 slug를 요구한다.
  `song-service.ts`의 생성/수정은 slug 중복을 처리하지 않는다. 관리자 mutation identity는 숫자 id다.
- `song-service.test.ts`는 repository mock 기반이다. DB uniqueness를 증명하지 않는다.
- Domain Specification §8.1~8.2는 Song.id와 Song + Mode guide 관계를 정의하지만
  slug의 전역/앨범별 유일성이나 rename 호환성은 정하지 않는다.

### Invariant to Preserve

- RSC → Service → Repository(DbExecutor), HTTP Zod/DTO, service admin 권한 경계를 유지한다.
- Song.id를 곡 identity로 보존한다. slug 변경이나 album 이동으로 기존 곡을 새 곡으로 만들지 않는다.
- 공개 Song/Album visibility 검사와 관리자 id 기반 mutation을 보존한다.
- 기존 migration을 고치지 않고, 운영 credential 및 로컬 application DB를 사용/변경하지 않는다.
- 기존 URL 변경과 과거 URL 호환성은 제품 결정으로 명시한다. 자동 backfill/rename으로 숨기지 않는다.
- CheerGuide/Revision 신규 기능은 이번 범위 밖이며 그 URL을 선제 확정하지 않는다.

### Options

| 기준 | A. 전역 고유 slug | B. 앨범별 고유 slug | C. 비고유 slug | D. 별도 안정 공개 identity |
| --- | --- | --- | --- | --- |
| URL 의미 | 현재 /songs/{slug} 유지 | album + slug 필요 | slug 단독으로 곡 지정 불가 | id 등을 주소에 포함, slug는 설명용 가능 |
| findFirst 모호성 | non-null 전역 유일성으로 해소 | album 조건 없는 현재 조회는 여전히 모호 | 추가 식별자 없이는 미해결 | 안정 identity 조회로 해소 |
| 기존 URL | 기존 slug 유지 시 호환 | 구주소 해석/redirect 정책 필요 | 현 주소가 계속 모호 | 구주소 매핑/redirect 필요 |
| album 이동 | URL 유지 | URL 변경 및 목적 앨범 충돌 가능 | 중복 문제 유지 | identity 유지 가능 |
| rename | URL 변경; 불변 또는 alias 정책 선택 필요 | 복합 URL 변경 | 모호성과 링크 단절 동시 발생 가능 | id 유지; 설명용 slug redirect 여부 선택 |
| SEO | 기존 URL 유지에 유리; rename 별도 처리 | 주소 전환과 canonical 정리 필요 | canonical 대상 곡 불명확 | 전환/redirect 후 안정 URL 가능 |
| API identity | 공개 slug, 관리자 id 유지 가능 | 공개 계약에 album 추가 | 공개 API에 추가 키 필요 | 공개 API/Query key도 identity 전환 검토 |
| 미래 Guide/Revision | 내부 Song.id 참조; URL 설계 별도 | album 이동 결합 피할 설계 필요 | 내부 id와 공개 URL 분리 필요 | 안정 참조에 유리; 미래 기능 선구현 불필요 |
| DB 제약 후보 | non-null slug 전역 unique, null 허용 유지 | (albumId, slug) unique | slug unique 없음 | 공개 identity unique/PK; slug 유일성 별도 |
| 충돌 UX | 중복 slug 생성/수정 409 및 필드 안내 | 같은 앨범 중복/이동 409 | slug 충돌 없음; 상세 곡 선택 UX 필요 | identity 충돌 방지; slug 중복 허용 여부 별도 |
| migration/backfill | 중복 사전 점검, 새 migration; 임의 정리 금지 | 복합 제약 + URL 전환 | 제약 변경 없지만 조회 재설계 필요 | 기존 id 재사용 또는 새 키 backfill 및 URL 전환 |

C는 현상 유지안이며 현재 단일 상세 조회의 모호성을 해결하는 완료안으로 권고하지 않는다.
D에서 기존 Song.id를 공개 식별자로 사용할 수 있는지는 별도 제품 선택이며 새 UUID 컬럼을 당연시하지 않는다.

### Recommended Minimal Change

**정책 제안만:** A를 권고한다. 현재 주소 체계와 album 이동을 유지하면서 모호성을 제거하는 범위가 가장 작다.
승인 요청 묶음은 다음과 같다. 아직 코드 변경 계획이나 확정 계약이 아니다.

1. 비공개 곡을 포함한 모든 non-null Song.slug를 전역 고유하게 한다. nullable legacy row는 유지한다.
2. 신규 입력의 기존 trim/소문자 규칙을 유지한다. 기존 데이터를 자동 소문자 변환하거나 rename하지 않는다.
3. 기존 non-null slug는 주소로 취급해 변경을 금지하는 것을 권고한다. title 변경/album 이동은 허용한다.
   null slug 최초 지정은 허용한다. 기존 수정 UX에 영향을 주므로 이 제한도 사용자 선택에 포함한다.
4. 중복 생성/수정은 409 및 slug 필드 안내 대상으로 삼는다. 임의 suffix 생성은 하지 않는다.
5. 기존 slug 변경이 필요하다면 alias/redirect·과거 slug 재사용 정책을 먼저 정하고 기술 계획을 다시 작성한다.
   삭제 후 slug 재사용/과거 URL 영구 예약까지 이번 전역 unique만으로 보장하지 않는다.

### Files Expected to Change

현재 허용 변경은 이 `docs/migration/m7-foundation-fixes/DATA-005.md` 하나뿐이다.
정책 선택 전 application/schema/migration/test/active architecture/Domain Specification 수정은 제외한다.
정책 승인 후 관련 active/domain 문서의 계약을 정합화하고 기술 PLAN을 별도로 확정해야 한다.
구현 파일 목록은 그때 조사·확정한다. 이 제안서로 schema 변경을 시작하지 않는다.

### Tests Required

이번 정책 문서는 근거와 대안의 정적 대조만 수행한다. application test를 추가하지 않는다.
정책 선택 후 기술 계획에서 최소 다음 검증의 구체 파일/명령을 확정한다.

- 선택 정책의 같은 앨범/다른 앨범/비공개 곡 중복 생성·수정, 자기 slug 유지, nullable legacy 행.
- rename 결정, title 변경, album 이동, 공개/관리자 URL 및 기존 visibility 동작.
- known conflict HTTP/클라이언트 오류 UX와 unrelated DB 오류의 안전한 500 처리.
- 실제 PostgreSQL 동시 중복 요청, 실패 후 기존 행 보존, 새 migration/catalog 확인.
- 코드 변경 기본 gate: pnpm type-check, pnpm test:harness, pnpm lint, pnpm lint:fsd,
  pnpm test:unit:run, pnpm format:check. runtime/build 변경 시 pnpm build.

### Actual PostgreSQL Verification

이번 단계: 재실행 없음. 위 2026-09-05 결과는 과거 관찰이며 현재 운영 데이터 증거가 아니다.
정책 선택 후 Docker Compose PostgreSQL의 별도 임시 DB에서 local guard 통과 → 기존 migration 적용
→ synthetic fixture → 승인된 새 migration → catalog 및 실제 Service/HTTP mapper 결과 확인을 계획한다.
중복 사전 존재 시 migration 실패/중단 경로와 non-null 동시 충돌도 검증해야 한다.
기존 로컬 application DB에 fixture나 migration을 적용하지 않고 임시 DB만 정리한다.
운영 적용과 운영 중복 정리는 별도 승인 계획으로 남긴다. 상세 절차는 정책 선택 뒤 기술 계획에서 확정한다.

### Risks / Unknowns

- 사용자 A/B/C/D 선택과 rename 정책이 미결이다. A 권고는 승인이 아니다.
- 과거 로컬 중복 0은 운영 중복 부재 또는 이후 로컬 상태를 보장하지 않는다.
- 기존 데이터의 대소문자/형식 차이, 운영 URL의 외부 링크 사용, 삭제 후 주소 재사용 요구는 미확인이다.
- unique 제약만으로 과거 URL redirect나 영구 예약을 제공하지 않는다.
- B/D 선택, rename 호환성 요구, 기존 중복 발견, 운영 데이터 정리가 필요하면 기술 계획 확정 전에 escalation한다.
- 민감 데이터가 포함될 수 있는 원본 DB 오류/행을 evidence에 기록하지 않는다.

### Implementation Prompt

현재 실행 금지: 사용자에게 A/B/C/D 및 rename 요구를 확인한다.
선택 후 이 정책 제안의 이력을 보존하고 DATA-005 기술 계획을 명시적으로 추가한다.
선택 정책, 승인된 불변식, 파일 범위, regression test와 격리 PostgreSQL 절차를 확정한 뒤에만
`/m7-implement DATA-005`를 진행한다. 다른 finding이나 future domain 구현을 섞지 않는다.
구현과 필수 검증 evidence가 완성된 뒤에만 `/m7-review DATA-005`를 순차 진행한다.

## IMPLEMENTATION

pending

## VERIFICATION

정책 문서 근거 정적 대조 완료. git fetch로 분기 기준 일치 확인.
application test/build/DB 검증은 이번 단계에서 실행하지 않았다.

## REVIEW

pending
