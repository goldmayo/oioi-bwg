# Architecture Decision Records

기준은 P06 종료 후·P07 시작 전의 migration_main 4a517def6da34ea3c9ad883f8e9146112a032e37다.
2026-10-25에 완료 문서와 병합 이력을 대조해 소급 작성했다. ADR은 결정의 배경·대안·영향을
기록하며 현재 구현을 규정하는 active architecture와 Domain의 우선순위를 바꾸지 않는다.
이후 신규 결정은 각 ADR의 작성일·상태를 따르며 위 소급 기록의 기준일로 해석하지 않는다.
당시 판단을 나중의 성공으로 정당화하지 않고, 정정·실패·미검증 범위를 함께 읽는다.

| ADR                                       | 결정 기간        | 결정                                        |
| ----------------------------------------- | ---------------- | ------------------------------------------- |
| [0001](0001-data-and-state-boundaries.md) | 2026-08~09       | 데이터 접근과 클라이언트 상태 소유권        |
| [0002](0002-workspace-app-boundaries.md)  | 2026-10-06~07    | 공개 Web과 운영 Console의 워크스페이스 분리 |
| [0003](0003-console-mfa.md)               | 2026-10-10~21    | Console MFA 증명과 회수 경계                |
| [0004](0004-promotion-and-runtime.md)     | 2026-09~10-25    | 검증한 이미지 쌍의 Promotion과 운영 전환    |
| [0005](0005-observability.md)             | 2026-09-20~10-25 | 안전한 오류 추적과 Slack relay의 책임       |
| [0006](0006-tooling-ownership.md)         | 2026-10-23~25    | 모노레포 검사와 캐시의 실제 소비처 소유권   |
| [0007](0007-composable-table.md)          | 2026-10-25       | 공용 테이블 지원 범위와 소비처 조합 책임    |
| [0008](0008-documentation-lifecycle.md)   | 2026-10-25~26    | 현재·보류 목록과 완료 설계 삭제·근거 수명   |

- [완료 설계 문서 지도](../migration/implementation/COMPLETED-DESIGN-INDEX.md)
- [0009: UUIDv7 단일 도메인 identity와 DB 물리 이름](0009-uuid-domain-identity.md) — 2026-10-26 신규 결정. 전환 구현 진행 중.
- [시간순 devlog](../devlog/README.md)
- 향후 결정 변경은 기존 기록을 덮어쓰지 않고 후속 ADR에서 supersedes 관계를 명시한다.
