# 문서 안내

P06 운영 전환을 종료했고 P07~P10은 미착수다. 현재·보류 작업의 상태와 다음 행동은
[WORK](WORK.md) 한 곳에서 관리한다. 설계의 제안과 실제 구현·배포 결과를 구분해 읽는다.

- 구현 기준: [헌법과 active architecture](migration/oioi-bwg-architecture-clean-v1/00-document-index.md), [Domain](migration/DOMAIN_SPECIFICATION.md)
- 개발·운영: [로컬 개발환경](migration/implementation/LOCAL-DEVELOPMENT-ENVIRONMENT.md), [OCI 운영](../ops/oci/README.md), [www 전환·인증서 관리](../ops/oci/web-cutover.md)
- 정리 근거: [P07 전 문서 부채 정리 결과](migration/implementation/DOCUMENTATION-CLEANUP-RESULT.md)
- 결정·과정: [ADR](adr/README.md), [시간순 devlog](devlog/README.md), [완료 작업 근거 지도](migration/implementation/COMPLETED-DESIGN-INDEX.md)
- 다음 기능의 제안: [Console 이후 설계](migration/implementation/console-guide-editor/DESIGN.md), [기능별 범위와 의존성](migration/implementation/console-guide-editor/ROADMAP.md)
- 과거 관찰: [역공학 대표 snapshot과 source 한계](reverse-engineering/README.md). 역사적 snapshot은 현재 구현 기준이 아니다.

Domain은 도메인 정책의 기준이며 전체 기능의 구현 완료를 뜻하지 않는다. 미착수 기능과 현행 계약의
적용 범위는 WORK·각 기능 제안에서 확인하고, 충돌을 구현 편의로 약화하지 않는다.

현재 경로를 유지한다. product/design/engineering/audits/devlog 구조와 루트 PRODUCT.md·DESIGN.md의
재편은 P10 이후 별도 작업이다. 향후 요약 문서는 상세 요구사항·화면 명세·기술 계약을 복제하지 않고
각 소유 문서에 연결하며, audits/to-be의 개선 제안은 승인된 구현 기준과 구분한다.
