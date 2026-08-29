---
title: "M2 Additional Refactor Inventory"
document_id: "M2-STRUCTURE-REFACTOR-INVENTORY"
version: "1.0"
status: "active"
authority: "plan"
updated_at: "2026-08-29"
depends_on:
  - "M2-STRUCTURE"
  - "M2-STRUCTURE-CHECKPOINT-SHARED-BOUNDARIES"
---

# M2 Additional Refactor Inventory

## 목적

M2의 shared consumer를 다시 세어 route-local 우선 원칙에 따라 추가 이관 후보를 확정한다.
재사용 근거가 없는 UI를 `widgets` 또는 `entities`로 승격하지 않으며, route composition은
해당 route의 private segment가 소유한다.

## 이번 checkpoint에서 이관한 항목

| 기존 위치 | 이관 위치 | 근거 |
|---|---|---|
| `src/shared/ui/album/AlbumCard.tsx` | `src/app/(user)/_ui/album-card.tsx` | 홈 앨범 목록의 단일 consumer |
| `src/shared/ui/chant/FilteredChantList.tsx` | `src/app/(user)/chants/_ui/filtered-chant-list.tsx` | chants route의 단일 consumer와 route 전용 검색 상태 |
| `src/shared/ui/more/NoticeAccordion.tsx` | `src/app/(user)/more/notice/_ui/notice-accordion.tsx` | notice route의 단일 consumer와 공지 전용 데이터 shape |
| `src/shared/ui/InAppBrowserGuard.tsx` | `src/app/_ui/in-app-browser-guard.tsx` | root layout composition에서만 사용되는 app-level guard |

이동 후 route 외부에서 private path를 참조하지 않으며 URL과 데이터 계약은 변경하지 않았다.

## 승격하지 않은 항목

- `widgets`: 현재 여러 route에서 재사용되는 완성 화면 단위가 확인되지 않았다.
- `entities`: 현재 `Album`/`Song` 타입은 legacy persistence/UI 모델이며, DOMAIN_SPECIFICATION의
  Artist, Song, CheerGuide, Revision 모델과 DTO 계약이 아직 정립되지 않았다.
- `src/server`: DB/query/command의 server boundary 정착은 M3 책임이다.

도메인 entity와 query option은 M3 Service/Repository/DTO 경계 및 M4 API 계약 이후 실제
consumer와 함께 도입한다. 빈 디렉터리나 이름만 있는 slice는 생성하지 않는다.

## 보류/검토 항목

| 항목 | 현재 판단 | 후속 단계 |
|---|---|---|
| `AlbumDetailModal`, `AlbumDetailSkeleton` | album-info feature의 상세 interaction으로 유지 | M6 product refactoring에서 entity/widget 재평가 |
| `LyricsViewerClient` | chant-sync feature의 핵심 use-case UI로 유지 | M4 Query 전환 후 server-state 경계 재평가 |
| `AlbumListSkeleton` | home/chants 2개 route consumer로 shared 유지 | M2 완료 시 consumer 회귀 확인 |
| `MoreCommon`, navigation UI | more/user layout 공통 composition으로 shared 유지 | consumer 증가 시 widget 검토 |
| 미사용 `ThemeToggle` 등 | 이번 이동과 무관한 dead-code 후보 | 별도 삭제 checkpoint에서 사용처·제품 요구 확인 |

## 완료 기준

- [x] 단일 consumer UI의 route-local 이관
- [x] root layout 전용 guard의 app-local 이관
- [x] widgets/entities/server를 추측으로 생성하지 않음
- [ ] route inventory와 M2 handoff 문서 최종화
- [ ] 사용자 확인 후 M2 브랜치 커밋/PR 진행
