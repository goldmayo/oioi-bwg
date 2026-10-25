---
title: "공개 Web SEO 점검과 수정 결과"
kind: migration-result
status: implementation-complete
authority: evidence
source_commit: 7f16a9d74e526f50a5f17e6821ed980d1057cabd
created_at: "2026-10-25"
---

# 공개 Web SEO 수정 결과

## 기준과 실제 발견

저장소 `goldmayo/oioi-bwg`, `feature/web-seo-corrections`는 위 `origin/migration_main`에서 분기했다.
검증 대상은 이 기준에 이번 PR diff를 더한 작업 트리다. 운영 관찰은 수정 전 #246 배포를 대상으로 한
2026-10-25 공개 HTTP 읽기이며, 코드 수정이 운영에 배포됐다는 뜻은 아니다.
상위 계약은 [Runtime §12](../oioi-bwg-architecture-clean-v1/11-content-i18n-assets-runtime-architecture.md#12-runtime),
[Server/Data Access](../oioi-bwg-architecture-clean-v1/06-server-data-access-architecture.md)와
[Domain](../DOMAIN_SPECIFICATION.md)의 공개 범위다.

| 확인한 문제                                                              | 실제 조치                                                                   |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| 기본 OG `/images/og_oioibawige.webp`는 www에서 404, R2의 같은 파일은 200 | 기존 assets 원본 URL 사용. 새 업로드·이미지 생성 없음                       |
| 곡/앨범에 canonical 누락, 상세 OG identity 일부 소실                     | 실제 slug의 canonical/og:url과 site/type/locale 설정, QWER 응원법 제목·설명 |
| 앨범 OG가 존재하지 않는 slug 파일명을 추측                               | 저장된 `album.imgUrl` 사용                                                  |
| chants/more의 제목·설명·OG URL 중복                                      | route별 제목·설명·canonical, 제보 폼은 noindex                              |
| 사이트맵 27개 URL에 숨김 앨범의 `blue-whale` 포함                        | 곡과 상위 앨범 공개 여부·실제 reader의 필수 필드를 함께 확인                |
| 사이트맵은 홈/곡만 있고 홈 수정일을 요청 때마다 생성                     | 공개 앨범·주요 정적 페이지 추가, 실제 곡 수정일만 선택적으로 제공           |
| 임의 약관 slug가 개인정보 페이지로 표시되는 soft 404                     | 미등록 slug는 `notFound()`                                                  |
| manifest의 512px 아이콘은 404                                            | 존재하는 192px 아이콘을 유지하고 없는 항목만 제거                           |

Web의 local/production URL 계약, DB 콘텐츠·schema·Console 인증은 유지한다. sitemap 조회는 기존 executor
관계 조회로 album 공개 필드만 추가하고 HTTP 내부 조회·새 cache·migration을 도입하지 않는다.

## 검증과 적용 경계

- 추가/관련 단위 검사 28건 통과: 메타데이터·sitemap 12건, song service 16건.
- `NEXT_PUBLIC_APP_ENV=local pnpm verify` 통과: 전체 type/lint/FSD/unit, repo 경계·harness 46건,
  ops 287건·format, Web/Console 실제 standalone build. 최초 추가 테스트의 production 환경 가정은
  명시적 env 격리로 수정한 뒤 전체를 재실행했다.
- 기존 PostgreSQL 공개 범위 통합 시나리오에 sitemap의 공개 곡 포함·숨김 곡/상위 앨범 제외 검사를 추가했다.
  로컬 Docker Desktop WSL 연결이 없어 실제 DB 검사는 로컬에서 실행하지 못했다. 해당 검사의 실제 실행은 PR CI에서 별도로 확인한다.
- report metadata/manifest를 포함한 최종 staged tree도 `pnpm verify` 통과. 이 최종 실행은 Web을 새로 build하고 Console은 직전 성공 cache를 재사용했다.
- 운영 DNS·WAF·DB·배포는 변경하지 않았다. 새 image Promotion 전까지 운영에는 수정 전 결과가 남는다.
  Search Console의 색인/순위·실제 Googlebot 판정은 이 코드/공개 HTTP 검사로 확인하지 않았다.

메타데이터/사이트맵 처리 근거는 [Next Metadata](https://nextjs.org/docs/app/api-reference/functions/generate-metadata),
[Google canonical](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls),
[Google sitemap lastmod](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)다.
