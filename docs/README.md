# 문서 안내

P06 운영 전환을 종료했고 P07~P10은 미착수다. 현재·보류 작업의 상태와 다음 행동은
[WORK](WORK.md) 한 곳에서 관리한다. 설계의 제안과 실제 구현·배포 결과를 구분해 읽는다.

- 구현 기준: [헌법과 active architecture](migration/oioi-bwg-architecture-clean-v1/00-document-index.md), [Domain](migration/DOMAIN_SPECIFICATION.md)
- 개발·운영: [로컬 개발환경](migration/implementation/LOCAL-DEVELOPMENT-ENVIRONMENT.md), [OCI 운영](../ops/oci/README.md), [www 전환·인증서 관리](../ops/oci/web-cutover.md)
- 결정·과정: [ADR](adr/README.md), [시간순 devlog](devlog/README.md), [완료 작업 근거 지도](migration/implementation/COMPLETED-DESIGN-INDEX.md)
- 다음 기능의 제안: [Console 이후 설계](migration/implementation/console-guide-editor/DESIGN.md), [기능별 범위와 의존성](migration/implementation/console-guide-editor/ROADMAP.md)
- 과거 관찰: [역공학 비교와 source 한계](reverse-engineering/10-main-to-migrated-gap-map.md). 역사적 snapshot은 현재 구현 기준이 아니다.

현재 경로를 유지한다. product/design/engineering/audits/devlog 구조와 루트 PRODUCT.md·DESIGN.md의
재편은 P10 이후 별도 작업이다. 향후 요약 문서는 상세 요구사항·화면 명세·기술 계약을 복제하지 않고
각 소유 문서에 연결하며, audits/to-be의 개선 제안은 승인된 구현 기준과 구분한다.
