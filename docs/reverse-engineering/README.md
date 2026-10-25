# 역공학 snapshot 안내

이 문서들은 과거 소스의 관찰 근거다. 현행 구현 기준은 [active architecture](../migration/oioi-bwg-architecture-clean-v1/00-document-index.md),
현재·보류 작업은 [WORK](../WORK.md)가 소유한다.

| 대표 snapshot                             | 수명과 source                                                          | 읽을 때의 한계                                                                                  |
| ----------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [legacy-main](legacy-main/00-index.md)    | main `4b299934846f4a0eed7132f58c5b1c2a481a3739` 고정                   | 당시 코드 관찰. 현재 코드로 덮어쓰지 않음                                                       |
| migrated-current 01~08                    | 2026-09-05 문서의 보존 snapshot. 원래 코드 branch/commit은 **unknown** | 이름의 current는 현재 checkout을 뜻하지 않음. 이번 정리는 source 사실을 재검증한 refresh가 아님 |
| [gap map](10-main-to-migrated-gap-map.md) | 위 두 문서 snapshot의 비교                                             | migrated source 미확정으로 해당 결론의 코드 재현성은 제한됨                                     |

## 대표 사본

- [01 IA](migrated-current/01-ia-menu-structure.md)
- [02 화면 목록](migrated-current/02-screen-id-list.md)
- [03 접근 제어](migrated-current/03-access-control-structure.md)
- [04 사용자 과정](migrated-current/04-user-process-inventory.md)
- [05 화면 명세](migrated-current/05-screen-spec.md)
- [06 호출 흐름](migrated-current/06-process-flow.md)
- [07 데이터베이스](migrated-current/07-database-spec.md)
- [08 API](migrated-current/08-api-spec.md)

2026-10-26에 root 01~08과 migrated-current 01~08의 SHA-256·byte 동일성을 8쌍 모두 확인했다.
각 root 파일과 같은 basename의 migrated-current 파일을 일대일 대표로 정하고 root 중복 8개를 삭제했다.
분석 본문은 보존하고 대표 사본에 관찰 문서의 역할·수명·unknown source를 명시했다.
legacy-main의 10개 파일은 변경하지 않는다.

문서의 최초 추가 commit은 `e31f7295d3d9575e37a954986b89a701fd39547d`다.
[정리 전 문서 tree](https://github.com/goldmayo/oioi-bwg/tree/e93ae610169e4ce0e9b7f1a75a9a02cbf179d46f/docs/reverse-engineering)는 원문 출처이며,
이 두 SHA를 분석한 코드 source로 간주하지 않는다. 정확한 source가 없다는 한계를 임의 SHA로 채우지 않는다.

## legacy-main 고정 본문

[01-ia-menu-structure](legacy-main/01-ia-menu-structure.md), [02-screen-id-list](legacy-main/02-screen-id-list.md), [03-access-control-structure](legacy-main/03-access-control-structure.md), [04-user-process-inventory](legacy-main/04-user-process-inventory.md), [05-screen-spec](legacy-main/05-screen-spec.md), [06-process-flow](legacy-main/06-process-flow.md), [07-database-spec](legacy-main/07-database-spec.md), [08-api-spec](legacy-main/08-api-spec.md), [09-runtime-infrastructure-inventory](legacy-main/09-runtime-infrastructure-inventory.md)
