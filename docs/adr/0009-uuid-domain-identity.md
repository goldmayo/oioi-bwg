---
title: "ADR 0009: UUIDv7 단일 도메인 identity와 DB 물리 이름"
kind: adr
status: accepted
recorded_at: "2026-10-26"
decision_period: "2026-10-26"
source_commit: e447c87b12008f3c94df63b70d30ef969df6a6fb
---

# ADR 0009: UUIDv7 단일 도메인 identity와 DB 물리 이름

## 배경과 결정

사용자는 장기적으로 내부·외부 ID 하나를 원하며 지정 Console 관리자의 재등록을 수용했다.
운영 READ ONLY 관찰은 Album 9행·Song 26행·ACTIVE ADMIN 1행이며, 로컬에 없는 숨김 앨범도 있다.
기존 정수 값과 데이터/관계 보존을 구분할 필요가 있다. 도메인 계약은
[Domain DP-008](../migration/DOMAIN_SPECIFICATION.md#dp-008-도메인-identity는-uuidv7-단일-pk를-사용한다)이 소유한다.

PostgreSQL 17의 native uuid에 서버 `uuid` 라이브러리가 발급한 v7을 저장한다.
영구 integer/public_id 이중 체계와 PostgreSQL 업그레이드·확장 도입을 선행하는 안은 채택하지 않는다.
정수보다 큰 인덱스와 전환 비용을 수용한다. 인덱스 성능 개선을 측정 없이 약속하지 않는다.
UUID에는 시각 정보가 있으므로 비밀 토큰이나 권한 검사 대체물로 사용하지 않는다.
challenge UUIDv4와 자연 복합 PK는 유지한다. R2 object key는 이 결정의 대상이 아니다.

이번 구현안은 기존 6개 테이블과 같은 단수 snake_case를 DB 물리 이름에 적용한다.
`Album/Song → album/song`, `albumId → album_id`, `imgUrl → image_url`, `order → sort_order`로
대응하고 나머지 camelCase 컬럼·제약·인덱스도 일관되게 개명한다. TS/HTTP의 업무 필드명과
값·FK action·unique 의미는 유지한다. 변경된 제약 이름은 repository의 오류 번역에도 반영한다.

## 전환 경계와 한계

첫 checkpoint(#261)는 생성/검증 계약과 쓰기 없는 대응표 도구였다. 전환 후보는 그 이후 별도로 검증한다.
대응표는 Album/Song 원본 ID와 부모 관계의 fingerprint를 고정하고 저장한 표를 재사용한다.
콘텐츠 전체 보존은 별도 전후 payload 검증이 필요하다. UUID 발급 시각은 과거 생성일이 아니다.
표는 한시적인 전환/복구 자료이며 정상 스키마에 영구 legacy_id를 남기는 근거가 아니다.

현재 규모에서는 쓰기 중단 후 앱/DB를 함께 바꾸는 방식을 우선 설계한다. 단계별 독립 배포나
dual write보다 중단·리허설 비용을 택한 판단이며 허용 중단 시간은 아직 확정하지 않았다.
숫자 JWT subject는 전환 후 거부한다. MFA AAD도 accountId에 결합되므로 지정 관리자만
credential/MFA를 재설정하고 제한된 bootstrap 경로로 다시 등록한다. 공개 가입은 재개하지 않는다.
계정/profile 및 다른 사용자 전체를 TRUNCATE하지 않는다. UUID 순서를 업무 표시 순서로 쓰지 않는다.

실제 적용은 새 migration·로컬 복원/실패 복구·같은 앱 이미지 쌍의 검증 후 구체화한다.
쓰기 재개 후에는 구 이미지 재배포만으로 복구할 수 없다. 대응표·백업과 신규 행 처리 정책이 필요하다.
운영 READ ONLY 승인은 운영 migration 적용 승인으로 간주하지 않는다.

2026-10-26 후속 구현에서는 v2 대응표에 Account의 role/status/MFA version과 명시적 reset 대상도
포함한다. SQL이 table lock 아래 coverage·부모 관계·계정 상태를 재확인하고 같은 transaction에서
타입/물리 이름을 바꾼 뒤 전체 Album/Song payload와 FK를 대조한다. 알 수 없는 MFA를 가진 계정은
자동 초기화하지 않는다. 지정 ADMIN만 credential을 제거하고 MFA version을 올려 재등록한다.
Console 정렬은 앨범 발매일 ASC(NULLS LAST) → 앨범 slug → 트랙 순서 → 곡 slug이며 UUID 순서를 쓰지 않는다.
public의 기존 정렬은 유지한다. 운영 적용의 중단 시간과 쓰기 재개 후 복구는 여전히 별도 판단이다.

## 사용과 소유권

대응표·legacy dump 복원·재등록의 반복 절차는 [로컬 개발 안내](../migration/implementation/LOCAL-DEVELOPMENT-ENVIRONMENT.md#uuidv7-전환과-legacy-dump-복원)가 소유한다.
v1은 초기 dry-run 자료이며 v2와 혼용하지 않는다. 저장한 v2 표는 재시도 시 재사용한다.

[Notion 실측·계획](https://app.notion.com/p/404395eb18c28034b39debf1bd080612)이 조사/여러 PR 계획을,
[WORK](../WORK.md)가 다음 행동을, PR 본문이 실제 검증과 실패를 소유한다. 이 ADR은 장기 선택의
대안·비용·경계만 유지한다. 결정 변경 시 담당 구현자가 Domain과 함께 후속 ADR로 개정한다.

## 기술 근거

- [PostgreSQL 17 UUID 타입](https://www.postgresql.org/docs/17/datatype-uuid.html), [v4 생성 함수](https://www.postgresql.org/docs/17/functions-uuid.html)
- [RFC 9562 UUIDv7](https://www.rfc-editor.org/rfc/rfc9562.html#section-5.7), [uuid 공식 API](https://github.com/uuidjs/uuid#uuidv7options-buffer-offset)
